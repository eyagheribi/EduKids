using System.Text.Json;

public class EngineTests
{
    private static JsonElement Json(string value) => JsonDocument.Parse(value).RootElement.Clone();

    [Theory]
    [InlineData("11+111", 122)]
    [InlineData("(4-7)+8-(4*0)", 5)]
    [InlineData("12 / 3 + 5 * (2 - 1)", 9)]
    [InlineData("-(2 + 3) * 2", -10)]
    [InlineData("1.5 + 2.25", 3.75)]
    public void Math_ParsesExpectedExpression(string expression, decimal expected)
    {
        var engine = new MathEngine();
        engine.Validate(Json(JsonSerializer.Serialize(new { expression })));
        var result = engine.Evaluate(Json(JsonSerializer.Serialize(new { expression })), Json(JsonSerializer.Serialize(new { value = expected })));
        Assert.True(result.Correct);
    }

    [Theory]
    [InlineData("10/0")]
    [InlineData("4++*3")]
    [InlineData("(5+2")]
    public void Math_RejectsInvalidExpressions(string expression) => Assert.Throws<DomainException>(() => new MathEngine().Validate(Json(JsonSerializer.Serialize(new { expression }))));

    [Fact]
    public void Matching_ScoresCorrectAssociationsWithoutMixingGames()
    {
        var engine = new MatchingEngine();
        var content = Json("{\"pairs\":[{\"id\":\"00000000-0000-0000-0000-000000000001\",\"left\":\"Red\",\"right\":\"Rouge\"},{\"id\":\"00000000-0000-0000-0000-000000000002\",\"left\":\"Blue\",\"right\":\"Bleu\"},{\"id\":\"00000000-0000-0000-0000-000000000003\",\"left\":\"Green\",\"right\":\"Vert\"}]}");
        var playable = engine.Generate(content);
        var matching = Assert.IsType<MatchingPlayable>(playable);
        var correct = Json(JsonSerializer.Serialize(new MatchingAnswer(matching.CorrectMatches)));
        var result = engine.Evaluate(content, correct, Json(JsonSerializer.Serialize(playable)));
        Assert.True(result.Correct);
        Assert.Equal(3, result.Score);
        var play = matching;
        Assert.Equal(3, play.Left.Length);
        Assert.Equal(3, play.Right.Length);
    }

    [Fact]
    public void SentenceOrdering_UsesTokenIdsAndPreservesRepeatedAccentedWords()
    {
        var engine = new SentenceOrderingEngine();
        var content = Json("{\"sentence\":\"Été très très chaud.\"}");
        var play = Assert.IsType<SentencePlayable>(engine.Generate(content));
        var answer = Json(JsonSerializer.Serialize(new SentenceAnswer(play.CorrectOrder)));
        var result = engine.Evaluate(content, answer, Json(JsonSerializer.Serialize(play)));
        Assert.Equal(4, play.Words.Count);
        Assert.True(result.Correct);
    }
}
