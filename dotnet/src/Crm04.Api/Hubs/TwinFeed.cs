using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Crm04.Domain.Machine;
using Crm04.Domain.Serialization;

namespace Crm04.Api.Hubs;

/// <summary>
/// The 3D scene's own feed, at <c>/ws/twin</c>. A RAW WEBSOCKET, consumed directly by browser
/// JavaScript.
///
/// TWO DECISIONS ARE BAKED IN HERE, and both are the crux of making a WebGL twin work under
/// Blazor at all.
///
/// FIRST, THE SCENE DOES NOT GO THROUGH BLAZOR. The obvious way to drive three.js from Blazor is
/// JS interop, and at 108 tags x 10 Hz that is 1,080 marshalled calls a second, each a JSON
/// serialise plus a circuit message. It would be catastrophic, and it is why most Blazor + WebGL
/// attempts feel bad. Instead the JS module opens its own socket here and receives
/// <see cref="TwinTargets"/> - about 22 numbers, ~180 bytes - ten times a second. There are ZERO
/// interop calls on the frame path. The cost is one extra socket per browser tab on the twin
/// page, and it buys a 60 fps scene whose smoothness does not depend on circuit health.
///
/// SECOND, A RAW SOCKET RATHER THAN SIGNALR. This feed is one-way server-to-client push of a
/// small JSON object. None of what SignalR adds - negotiation, transport fallback, RPC, groups -
/// is used, and taking it would mean vendoring a ~130 KB client library into an application that
/// otherwise ships no JavaScript dependencies. It is also the shape docs/INTEGRATION.md already
/// specifies for this application's gateway. Reconnect is a dozen lines in the client.
///
/// The targets are still derived SERVER-SIDE from the one MachineState, so the position of a roll
/// in the scene and the number on the KPI tile remain the same statement (§18) even though they
/// arrive by different routes.
/// </summary>
public sealed class TwinFeed
{
    private readonly ConcurrentDictionary<Guid, WebSocket> _sockets = new();
    private readonly ILogger<TwinFeed> _log;

    public TwinFeed(ILogger<TwinFeed> log) => _log = log;

    public int ConnectedClients => _sockets.Count;

    /// <summary>
    /// Hold a connected socket open until the client goes away.
    ///
    /// Nothing is read from the client - the scene never talks back - but the read loop is still
    /// necessary: it is how a close handshake is observed. Without it a closed tab would leave a
    /// dead socket in the dictionary being written to forever.
    /// </summary>
    public async Task HandleAsync(WebSocket socket, TwinTargets initial, CancellationToken ct)
    {
        var id = Guid.NewGuid();
        _sockets[id] = socket;
        _log.LogInformation("Twin client connected ({Count} total).", _sockets.Count);

        try
        {
            // Send the current pose immediately so the scene builds itself into the right shape
            // rather than starting at zero and snapping on the first frame.
            await SendAsync(socket, initial, ct);

            var buffer = new byte[256];
            while (socket.State == WebSocketState.Open && !ct.IsCancellationRequested)
            {
                var result = await socket.ReceiveAsync(buffer, ct);
                if (result.MessageType == WebSocketMessageType.Close) break;
            }
        }
        catch (OperationCanceledException)
        {
            // Shutdown.
        }
        catch (WebSocketException)
        {
            // A browser tab closing mid-frame is normal, not an error worth a stack trace.
        }
        finally
        {
            _sockets.TryRemove(id, out _);
            _log.LogInformation("Twin client disconnected ({Count} remaining).", _sockets.Count);
        }
    }

    /// <summary>
    /// Push one set of targets to every connected scene.
    ///
    /// Serialised ONCE for all clients rather than per socket - at 10 Hz with several wall
    /// displays open that is the difference between one serialisation and a dozen.
    ///
    /// A failed send drops that socket and never throws. This runs on the 10 Hz publish path, and
    /// one browser going away must not interrupt the frame for everyone else.
    /// </summary>
    public async Task BroadcastAsync(TwinTargets targets, CancellationToken ct)
    {
        if (_sockets.IsEmpty) return;

        var payload = JsonSerializer.SerializeToUtf8Bytes(targets, WireJson.Options);

        foreach (var (id, socket) in _sockets)
        {
            try
            {
                if (socket.State != WebSocketState.Open)
                {
                    _sockets.TryRemove(id, out _);
                    continue;
                }

                await socket.SendAsync(payload, WebSocketMessageType.Text, endOfMessage: true, ct);
            }
            catch (Exception ex) when (ex is WebSocketException or ObjectDisposedException or OperationCanceledException)
            {
                _sockets.TryRemove(id, out _);
            }
        }
    }

    private static async Task SendAsync(WebSocket socket, TwinTargets targets, CancellationToken ct)
    {
        var payload = JsonSerializer.SerializeToUtf8Bytes(targets, WireJson.Options);
        await socket.SendAsync(payload, WebSocketMessageType.Text, endOfMessage: true, ct);
    }

    /// <summary>Encoding note kept for the JS client: UTF-8 text frames, one JSON object each.</summary>
    internal static string Describe() => Encoding.UTF8.EncodingName;
}
