using System.Security.Claims;
using Microsoft.Extensions.Configuration;

public class DevelopmentSecurityTests
{
    private static readonly Guid AllowedSpace = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static IConfiguration Configuration(bool enabled = true, string credential = "local-postman-secret") =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Development:TestAuth:Enabled"] = enabled.ToString(),
            ["Development:TestAuth:Credential"] = credential,
            ["Development:TestAuth:AllowedSpaceId"] = AllowedSpace.ToString(),
            ["Development:TestAuth:AllowedActivityTypes:0"] = "MATH",
            ["Development:TestAuth:AllowedActivityTypes:1"] = "MATCHING",
            ["Development:TestAuth:AllowedActivityTypes:2"] = "SENTENCE_ORDERING"
        }).Build();

    private static ClaimsPrincipal TestPrincipal(Guid? space = null, string[]? activityTypes = null)
    {
        var claims = new List<Claim>
        {
            new(DevelopmentTestAuthentication.SpaceClaim, (space ?? AllowedSpace).ToString())
        };
        foreach (var activity in activityTypes ?? ["MATH", "MATCHING", "SENTENCE_ORDERING"])
            claims.Add(new Claim(DevelopmentTestAuthentication.ActivityClaim, activity));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, DevelopmentTestAuthentication.Scheme));
    }

    [Fact]
    public async Task UnauthenticatedPrincipal_IsDenied()
    {
        var access = new DevelopmentSpaceAccess(Configuration());
        Assert.False(await access.CanAccess(AllowedSpace, new ClaimsPrincipal(), "MATH", default));
    }

    [Fact]
    public void InvalidOrMissingCredential_IsRejected_AndDisabledByDefault()
    {
        var enabledValidator = new DevelopmentTestCredentialValidator(Configuration());
        Assert.False(enabledValidator.IsValid(null));
        Assert.False(enabledValidator.IsValid("wrong-secret"));

        var disabledValidator = new DevelopmentTestCredentialValidator(Configuration(enabled: false));
        Assert.False(disabledValidator.IsValid("local-postman-secret"));
    }

    [Fact]
    public async Task DifferentSpaceId_IsDenied()
    {
        var access = new DevelopmentSpaceAccess(Configuration());
        var otherSpace = Guid.Parse("22222222-2222-2222-2222-222222222222");
        Assert.False(await access.CanAccess(otherSpace, TestPrincipal(), "MATH", default));
    }

    [Theory]
    [InlineData("MATH")]
    [InlineData("MATCHING")]
    [InlineData("SENTENCE_ORDERING")]
    public async Task ConfiguredTestSpaceAndActivity_AreAllowed(string activityType)
    {
        var config = Configuration();
        var validator = new DevelopmentTestCredentialValidator(config);
        Assert.True(validator.IsValid("local-postman-secret"));

        var access = new DevelopmentSpaceAccess(config);
        Assert.True(await access.CanAccess(AllowedSpace, TestPrincipal(), activityType, default));
    }
}
