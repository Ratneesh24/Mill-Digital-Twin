using System.Diagnostics.CodeAnalysis;
using Crm04.Domain.Types;

namespace Crm04.Domain.Tags;

/// <summary>
/// Indexed access to the generated tag catalogue. Port of the lookups at the foot of
/// <c>src/data/tagDefinitions.ts</c> (<c>tagDefinitionMap</c>, <c>getTagDefinition</c>,
/// <c>tagInventory</c>).
///
/// The records themselves live in <c>TagCatalog.Generated.cs</c>, which is written by
/// <c>scripts/exportTagCatalog.ts</c> from the TypeScript definition. This file is hand-written
/// and holds only the lookups, so regenerating the catalogue never clobbers logic.
/// </summary>
public static class TagCatalog
{
    private static readonly Dictionary<string, TagDefinition> ByName =
        TagCatalogData.All.ToDictionary(d => d.TagName, StringComparer.Ordinal);

    /// <summary>Every definition, in ordinal order. Index equals <see cref="TagDefinition.Ordinal"/>.</summary>
    public static IReadOnlyList<TagDefinition> All { get; } = TagCatalogData.All;

    public static int Count => TagCatalogData.All.Length;

    /// <summary>The definition, or null when this tag name is not in the catalogue at all.</summary>
    public static TagDefinition? TryGet(string tagName) =>
        ByName.TryGetValue(tagName, out var d) ? d : null;

    public static bool TryGet(string tagName, [NotNullWhen(true)] out TagDefinition? definition) =>
        ByName.TryGetValue(tagName, out definition);

    /// <summary>
    /// The wire ordinal for a tag, or null when unknown. Callers that put values into an
    /// ordinal-indexed array must treat null as "drop this tag", never as slot zero.
    /// </summary>
    public static int? OrdinalOf(string tagName) => TryGet(tagName)?.Ordinal;

    public static TagDefinition ByOrdinal(int ordinal) => TagCatalogData.All[ordinal];

    /// <summary>§7.4 summary counts, shown on the tag inventory page.</summary>
    public static TagInventory Inventory { get; } = new(
        Total: TagCatalogData.All.Length,
        MeasuredOnLiveFeed: CountAvailability(LiveAvailability.Measured),
        ReferenceOnLiveFeed: CountAvailability(LiveAvailability.Reference),
        CalculatedOnLiveFeed: CountAvailability(LiveAvailability.Calculated),
        EstimatedOnLiveFeed: CountAvailability(LiveAvailability.Estimated),
        UnavailableOnLiveFeed: CountAvailability(LiveAvailability.Unavailable));

    private static int CountAvailability(LiveAvailability a) =>
        TagCatalogData.All.Count(d => d.LiveAvailability == a);
}

/// <summary>
/// How many tags fall into each live-feed availability class. The headline of the tag inventory
/// page, and the honest answer to "how much of this screen is real?".
/// </summary>
public sealed record TagInventory(
    int Total,
    int MeasuredOnLiveFeed,
    int ReferenceOnLiveFeed,
    int CalculatedOnLiveFeed,
    int EstimatedOnLiveFeed,
    int UnavailableOnLiveFeed);
