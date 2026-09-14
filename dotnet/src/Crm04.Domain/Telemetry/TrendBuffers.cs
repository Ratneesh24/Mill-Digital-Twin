namespace Crm04.Domain.Telemetry;

/// <summary>
/// A fixed-capacity circular buffer of trend points. Port of <c>src/utils/ringBuffer.ts</c>.
///
/// BOUNDED BY CONSTRUCTION, never a list that is trimmed afterwards. This runs for months on a
/// control-room machine; an append-and-trim buffer is one forgotten trim away from being an
/// unbounded memory leak, and the failure would appear as the twin dying overnight.
/// </summary>
public sealed class RingBuffer
{
    private readonly TrendPoint[] _items;
    private int _start;

    public RingBuffer(int capacity)
    {
        if (capacity <= 0) throw new ArgumentOutOfRangeException(nameof(capacity));
        _items = new TrendPoint[capacity];
    }

    public int Capacity => _items.Length;

    public int Count { get; private set; }

    public void Push(TrendPoint point)
    {
        if (Count < _items.Length)
        {
            _items[(_start + Count) % _items.Length] = point;
            Count++;
            return;
        }

        // Full: overwrite the oldest and advance the window.
        _items[_start] = point;
        _start = (_start + 1) % _items.Length;
    }

    /// <summary>A snapshot in chronological order. Copied, so a reader is never racing a writer.</summary>
    public TrendPoint[] ToArray()
    {
        var result = new TrendPoint[Count];
        for (var i = 0; i < Count; i++) result[i] = _items[(_start + i) % _items.Length];
        return result;
    }

    public void Clear()
    {
        _start = 0;
        Count = 0;
    }
}

/// <summary>
/// Rolling history for every signal across every window. Port of
/// <c>src/store/telemetryStore.ts</c>.
///
/// Each window has a FIXED capacity and samples are DOWNSAMPLED ON WRITE. The one-hour window
/// stores one averaged point every 15 s rather than 36,000 raw points that a chart would have to
/// decimate on every repaint. That is the difference between a trend page that repaints in a
/// millisecond and one that stalls the circuit.
///
/// In the .NET topology this lives in the API, not the browser: one history for every viewer,
/// and a client that connects at 10:05 sees the same last hour as one that connected at 09:00.
/// The browser-side store in the React app could never do that.
///
/// Thread-safe because the frame publisher writes while HTTP requests read.
/// </summary>
public sealed class TrendStore
{
    private sealed class WindowBuffer(TrendWindow window)
    {
        public RingBuffer Buffer { get; } = new(TrendWindow.Capacity);
        public double IntervalMs { get; } = window.IntervalMs;
        public double Sum { get; set; }
        public int Samples { get; set; }
        public long LastEmit { get; set; }
    }

    private readonly object _gate = new();

    // [signal ordinal][window index]. Allocated up front so recording a sample never allocates
    // and never has to decide whether a buffer exists yet.
    private readonly WindowBuffer[][] _buffers;

    public TrendStore()
    {
        _buffers = new WindowBuffer[SignalCatalog.Count][];
        for (var s = 0; s < SignalCatalog.Count; s++)
        {
            _buffers[s] = SignalCatalog.Windows.Select(w => new WindowBuffer(w)).ToArray();
        }
    }

    public long SamplesRecorded { get; private set; }

    /// <summary>
    /// Record one sample for one signal.
    ///
    /// Non-finite values are DROPPED rather than stored. A NaN in a ring buffer poisons every
    /// average that includes it and leaves a permanent gap in the chart; and a NaN reading is not
    /// a measurement, so there is nothing to plot.
    /// </summary>
    public void Record(int signalOrdinal, double value, long timestampMs)
    {
        if (!double.IsFinite(value)) return;
        if ((uint)signalOrdinal >= (uint)_buffers.Length) return;

        lock (_gate)
        {
            foreach (var w in _buffers[signalOrdinal])
            {
                w.Sum += value;
                w.Samples++;

                if (w.LastEmit == 0) w.LastEmit = timestampMs;
                if (timestampMs - w.LastEmit < w.IntervalMs) continue;

                w.Buffer.Push(new TrendPoint(timestampMs, w.Sum / w.Samples));
                w.Sum = 0d;
                w.Samples = 0;
                w.LastEmit = timestampMs;
            }

            SamplesRecorded++;
        }
    }

    public TrendPoint[] Read(string signalKey, string windowKey)
    {
        var signal = SignalCatalog.TryGet(signalKey);
        if (signal is null) return [];

        var windowIndex = WindowIndex(windowKey);

        lock (_gate)
        {
            return _buffers[signal.Ordinal][windowIndex].Buffer.ToArray();
        }
    }

    /// <summary>How many points a window currently holds, for the diagnostics panel.</summary>
    public int PointCount(string windowKey)
    {
        var windowIndex = WindowIndex(windowKey);
        lock (_gate)
        {
            return _buffers.Length == 0 ? 0 : _buffers[0][windowIndex].Buffer.Count;
        }
    }

    /// <summary>
    /// Drop everything. Called when the source changes: mixing frames from two feeds into one
    /// series would draw a chart of a mill that never existed.
    /// </summary>
    public void Clear()
    {
        lock (_gate)
        {
            foreach (var signal in _buffers)
            {
                foreach (var w in signal)
                {
                    w.Buffer.Clear();
                    w.Sum = 0d;
                    w.Samples = 0;
                    w.LastEmit = 0;
                }
            }

            SamplesRecorded = 0;
        }
    }

    private static int WindowIndex(string windowKey)
    {
        for (var i = 0; i < SignalCatalog.Windows.Count; i++)
        {
            if (string.Equals(SignalCatalog.Windows[i].Key, windowKey, StringComparison.Ordinal)) return i;
        }

        // An unrecognised window is a client bug, not a reason to fail a chart request.
        for (var i = 0; i < SignalCatalog.Windows.Count; i++)
        {
            if (SignalCatalog.Windows[i].Key == SignalCatalog.DefaultWindow.Key) return i;
        }

        return 0;
    }
}
