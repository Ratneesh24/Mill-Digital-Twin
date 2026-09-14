using System.Text.RegularExpressions;
using Crm04.Domain.Tags;
using Shouldly;

namespace Crm04.Domain.Tests;

/// <summary>
/// Every <c>TagName="..."</c> in the Razor markup must name a tag the catalogue actually declares.
///
/// WHY THIS EXISTS. A readout bound to a tag that does not exist renders "— NO TAG" and looks
/// completely correct, because that is exactly what a readout for a genuinely unavailable tag
/// looks like. So a typo does not fail, it LIES: it tells the operator the feed cannot supply a
/// value when in truth the developer misspelled the name. This test caught three such rows
/// (TENSION.ENTRY.SPECIFIC, TENSION.EXIT.SPECIFIC, ROLL.GAP.DEVIATION) the first time it ran -
/// values that are derived in the projection and were never tags at all.
///
/// The rule that follows from that: a value with no tag behind it belongs in DerivedRow, badged
/// CALC, not in a ValueReadout bound to an invented name.
///
/// It lives in the domain test project because the catalogue does, and because it needs no
/// reference to Crm04.Web - it reads the markup as text.
/// </summary>
public class RazorTagReferenceTests
{
    private static readonly Regex TagNameAttribute =
        new("""TagName\s*=\s*"([^"]+)"\s*""", RegexOptions.Compiled);

    [Fact]
    public void EveryTagNameInTheMarkupExistsInTheCatalogue()
    {
        var componentsDir = ComponentsDirectory();

        // Not an assertion failure: the test project can legitimately be built and run in a
        // packaging context with no source tree beside it.
        if (componentsDir is null) return;

        var razorFiles = Directory.GetFiles(componentsDir, "*.razor", SearchOption.AllDirectories);
        razorFiles.ShouldNotBeEmpty("expected to find Razor components to scan");

        var offences = new List<string>();
        var checkedCount = 0;

        foreach (var file in razorFiles)
        {
            var lines = File.ReadAllLines(file);
            for (var i = 0; i < lines.Length; i++)
            {
                foreach (Match m in TagNameAttribute.Matches(lines[i]))
                {
                    var tagName = m.Groups[1].Value;

                    // Razor bindings like TagName="@someExpression" are resolved at runtime and
                    // cannot be checked here.
                    if (tagName.StartsWith('@')) continue;

                    checkedCount++;
                    if (TagCatalog.TryGet(tagName) is null)
                    {
                        offences.Add($"  {Path.GetFileName(file)}:{i + 1}  {tagName}");
                    }
                }
            }
        }

        checkedCount.ShouldBeGreaterThan(0, "the scan found no TagName attributes at all - has the regex or the layout changed?");

        if (offences.Count > 0)
        {
            Assert.Fail(
                $"{offences.Count} readout(s) reference a tag that is not in the catalogue.\n" +
                "These render as NO TAG and are indistinguishable from a genuine feed limitation.\n" +
                "If the value is derived rather than measured, use DerivedRow instead.\n\n" +
                string.Join("\n", offences));
        }
    }

    /// <summary>Walk up from the test binary to the Blazor components folder, or null if absent.</summary>
    private static string? ComponentsDirectory()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Crm04.sln")))
        {
            dir = dir.Parent;
        }

        if (dir is null) return null;

        var components = Path.Combine(dir.FullName, "src", "Crm04.Web", "Components");
        return Directory.Exists(components) ? components : null;
    }
}
