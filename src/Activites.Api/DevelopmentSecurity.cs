using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

public static class DevelopmentTestAuthentication
{
    public const string Scheme = "EduKidsDevelopmentTest";
    public const string CredentialHeader = "X-EduKids-Test-Credential";
    public const string SpaceClaim = "edukids:space_id";
    public const string ActivityClaim = "edukids:activity_type";
}

public interface ITestCredentialValidator
{
    bool IsValid(string? providedCredential);
}

public sealed class DevelopmentTestCredentialValidator(IConfiguration configuration) : ITestCredentialValidator
{
    public bool IsValid(string? providedCredential)
    {
        if (!configuration.GetValue<bool>("Development:TestAuth:Enabled") || string.IsNullOrWhiteSpace(providedCredential))
            return false;

        var configured = configuration["Development:TestAuth:Credential"];
        if (string.IsNullOrWhiteSpace(configured))
            return false;

        var providedBytes = Encoding.UTF8.GetBytes(providedCredential);
        var configuredBytes = Encoding.UTF8.GetBytes(configured);
        return providedBytes.Length == configuredBytes.Length && CryptographicOperations.FixedTimeEquals(providedBytes, configuredBytes);
    }
}

/// <summary>Local Postman-only scheme. Program registers this handler only in Development.</summary>
public sealed class DevelopmentTestAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    ITestCredentialValidator credentialValidator,
    IConfiguration configuration)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(DevelopmentTestAuthentication.CredentialHeader, out var credential))
            return Task.FromResult(AuthenticateResult.NoResult());

        if (!credentialValidator.IsValid(credential.ToString()))
            return Task.FromResult(AuthenticateResult.Fail("Invalid or disabled local development credential."));

        if (!Guid.TryParse(configuration["Development:TestAuth:AllowedSpaceId"], out var spaceId))
            return Task.FromResult(AuthenticateResult.Fail("The development test space is not configured."));

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "postman-development-parent"),
            new(DevelopmentTestAuthentication.SpaceClaim, spaceId.ToString())
        };
        foreach (var activityType in configuration.GetSection("Development:TestAuth:AllowedActivityTypes").Get<string[]>() ?? [])
            claims.Add(new Claim(DevelopmentTestAuthentication.ActivityClaim, activityType));

        var identity = new ClaimsIdentity(claims, DevelopmentTestAuthentication.Scheme);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}

/// <summary>Development allowlist. It still requires an authenticated test principal and exact configured claims.</summary>
public sealed class DevelopmentSpaceAccess(IConfiguration configuration) : ISpaceAccess
{
    public Task<bool> CanAccess(Guid spaceId, ClaimsPrincipal user, string activityType, CancellationToken ct)
    {
        var configuredSpace = configuration["Development:TestAuth:AllowedSpaceId"];
        var enabled = configuration.GetValue<bool>("Development:TestAuth:Enabled");
        var authorized = enabled
            && user.Identity?.IsAuthenticated == true
            && Guid.TryParse(configuredSpace, out var allowedSpace)
            && spaceId == allowedSpace
            && user.HasClaim(DevelopmentTestAuthentication.SpaceClaim, allowedSpace.ToString())
            && configuration.GetSection("Development:TestAuth:AllowedActivityTypes").Get<string[]>() is { } allowedTypes
            && allowedTypes.Contains(activityType, StringComparer.OrdinalIgnoreCase)
            && user.Claims.Any(claim => claim.Type == DevelopmentTestAuthentication.ActivityClaim && string.Equals(claim.Value, activityType, StringComparison.OrdinalIgnoreCase));

        return Task.FromResult(authorized);
    }
}

/// <summary>Safe default until the production Espaces.Api integration is supplied.</summary>
public sealed class DenyAllSpaceAccess : ISpaceAccess
{
    public Task<bool> CanAccess(Guid spaceId, ClaimsPrincipal user, string activityType, CancellationToken ct) => Task.FromResult(false);
}
