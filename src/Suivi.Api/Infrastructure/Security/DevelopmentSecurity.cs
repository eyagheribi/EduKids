using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Suivi.Api.Infrastructure.Security;

// ─────────────────────────────────────────────────────────────────────────────
// Development-only test authentication for Suivi.Api
// Modelled after Activites.Api's DevelopmentSecurity.cs pattern.
// NEVER register these components outside IsDevelopment().
// ─────────────────────────────────────────────────────────────────────────────

public static class SuiviDevAuth
{
    public const string Scheme = "SuiviDevelopmentTest";
    public const string CredentialHeader = "X-Suivi-Test-Credential";
    public const string SpaceIdClaim = "suivi:space_id";
}

public interface ISuiviSpaceAccess
{
    Task<bool> CanAccess(Guid spaceId, ClaimsPrincipal user, CancellationToken ct);
}

// ── Credential validator ──────────────────────────────────────────────────────

public sealed class SuiviDevCredentialValidator(IConfiguration configuration)
{
    public bool IsValid(string? provided)
    {
        if (!configuration.GetValue<bool>("Development:TestAuth:Enabled"))
            return false;
        if (string.IsNullOrWhiteSpace(provided))
            return false;
        var configured = configuration["Development:TestAuth:Credential"];
        if (string.IsNullOrWhiteSpace(configured))
            return false;

        var a = Encoding.UTF8.GetBytes(provided);
        var b = Encoding.UTF8.GetBytes(configured);
        return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
    }
}

// ── Authentication handler ───────────────────────────────────────────────────

public sealed class SuiviDevAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory loggerFactory,
    UrlEncoder encoder,
    SuiviDevCredentialValidator credentialValidator,
    IConfiguration configuration)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, loggerFactory, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(SuiviDevAuth.CredentialHeader, out var value))
            return Task.FromResult(AuthenticateResult.NoResult());

        if (!credentialValidator.IsValid(value.ToString()))
            return Task.FromResult(AuthenticateResult.Fail("Invalid or disabled development credential."));

        if (!Guid.TryParse(configuration["Development:TestAuth:AllowedSpaceId"], out var spaceId))
            return Task.FromResult(AuthenticateResult.Fail("Development test space not configured."));

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "suivi-dev-postman"),
            new(SuiviDevAuth.SpaceIdClaim, spaceId.ToString())
        };

        var identity = new ClaimsIdentity(claims, SuiviDevAuth.Scheme);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}

// ── Space access implementations ─────────────────────────────────────────────

/// <summary>
/// Development allowlist: only the configured AllowedSpaceId is accessible.
/// </summary>
public sealed class DevelopmentSuiviSpaceAccess(IConfiguration configuration) : ISuiviSpaceAccess
{
    public Task<bool> CanAccess(Guid spaceId, ClaimsPrincipal user, CancellationToken ct)
    {
        var enabled = configuration.GetValue<bool>("Development:TestAuth:Enabled");
        var configuredStr = configuration["Development:TestAuth:AllowedSpaceId"];

        var authorized = enabled
            && user.Identity?.IsAuthenticated == true
            && Guid.TryParse(configuredStr, out var allowed)
            && spaceId == allowed
            && user.HasClaim(SuiviDevAuth.SpaceIdClaim, allowed.ToString());

        return Task.FromResult(authorized);
    }
}

/// <summary>
/// Safe default: deny everything. Used in Production until Espaces.Api integration is ready.
/// </summary>
public sealed class DenyAllSuiviSpaceAccess : ISuiviSpaceAccess
{
    public Task<bool> CanAccess(Guid spaceId, ClaimsPrincipal user, CancellationToken ct)
        => Task.FromResult(false);
}
