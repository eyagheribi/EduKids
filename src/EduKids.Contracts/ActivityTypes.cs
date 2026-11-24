namespace EduKids.Contracts;

/// <summary>Canonical mapping between the persisted Espaces category and the Activites engine type.</summary>
public static class ActivityTypes
{
    public const string Maths = "Maths";
    public const string Association = "Association";
    public const string WordOrdering = "Ordonnancement";
    public const string Dictation = "Dictee";

    public const string MathEngine = "MATH";
    public const string MatchingEngine = "MATCHING";
    public const string WordOrderingEngine = "SENTENCE_ORDERING";
    public const string DictationEngine = "DICTATION";

    public static readonly IReadOnlyDictionary<string, string> EngineByCategory =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [Maths] = MathEngine,
            [Association] = MatchingEngine,
            [WordOrdering] = WordOrderingEngine,
            [Dictation] = DictationEngine
        };

    public static IReadOnlyCollection<string> Categories => EngineByCategory.Keys.ToArray();

    public static bool IsEnabled(IEnumerable<string> categories, string engineType) =>
        EngineByCategory.Any(pair =>
            string.Equals(pair.Value, engineType, StringComparison.OrdinalIgnoreCase)
            && categories.Contains(pair.Key, StringComparer.OrdinalIgnoreCase));

    public static string? EngineForCategory(string category) =>
        EngineByCategory.TryGetValue(category, out var engine) ? engine : null;

    public static string? CategoryForEngine(string engine) =>
        EngineByCategory.FirstOrDefault(pair => string.Equals(pair.Value, engine, StringComparison.OrdinalIgnoreCase)).Key;
}
