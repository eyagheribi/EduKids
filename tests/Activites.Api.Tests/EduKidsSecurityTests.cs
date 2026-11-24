using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Text;
using EduKids.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

public class EduKidsSecurityTests
{
    private const string Secret = "unit-test-signing-key-should-never-be-used-outside-tests-123456";
    private static readonly Guid SpaceId = Guid.Parse("e00858b9-22d4-4905-a686-3399ec3026b1");

    [Fact]
    public void SharedBearerOptions_RequireValidHs256SignatureAndExpiration()
    {
        var services = new ServiceCollection();
        services.AddEduKidsJwtBearer(Configuration());
        using var provider = services.BuildServiceProvider();
        var parameters = provider.GetRequiredService<IOptionsMonitor<JwtBearerOptions>>()
            .Get(JwtBearerDefaults.AuthenticationScheme).TokenValidationParameters;
        var handler = new JwtSecurityTokenHandler();
        handler.MapInboundClaims = false;

        var valid = Token("Parent", DateTime.UtcNow.AddMinutes(5));
        var principal = handler.ValidateToken(valid, parameters, out _);
        Assert.Equal("Parent", principal.FindFirst("role")?.Value);
        Assert.True(principal.Identity!.IsAuthenticated);

        var expired = Token("Parent", DateTime.UtcNow.AddMinutes(-5));
        Assert.Throws<SecurityTokenExpiredException>(() => handler.ValidateToken(expired, parameters, out _));

        var forged = valid[..^2] + "xx";
        Assert.ThrowsAny<SecurityTokenException>(() => handler.ValidateToken(forged, parameters, out _));
    }

    [Fact]
    public async Task ParentMustOwnSpaceAndHaveTheRequestedCategoryEnabled()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"activites\":[\"Maths\",\"Ordonnancement\"]}")
        });
        var auth = Access(handler, "Parent", SpaceId);
        Assert.True(await auth.ParentOwnsSpaceWithActivity(SpaceId, "SENTENCE_ORDERING", ParentPrincipal(), default));
        Assert.False(await auth.ParentOwnsSpaceWithActivity(SpaceId, "DICTATION", ParentPrincipal(), default));

        handler.Response = _ => new HttpResponseMessage(HttpStatusCode.NotFound);
        Assert.False(await auth.ParentOwnsSpace(SpaceId, ParentPrincipal(), default));
    }

    [Fact]
    public async Task ChildCanOnlyAccessItsOwnSpaceAndEnabledCategory()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"activites\":[\"Maths\"]}")
        });
        var auth = Access(handler, "Enfant", SpaceId);
        var child = ChildPrincipal(SpaceId);
        Assert.True(await auth.ChildOwnsSpaceWithActivity(SpaceId, "MATH", child, default));
        Assert.False(await auth.ChildOwnsSpaceWithActivity(SpaceId, "MATCHING", child, default));
        Assert.False(await auth.ChildOwnsSpaceWithActivity(Guid.NewGuid(), "MATH", child, default));
        Assert.Equal(2, handler.RequestCount);
    }

    private static EspacesApiAuthorization Access(StubHandler handler, string role, Guid spaceId)
    {
        var context = new DefaultHttpContext();
        context.Request.Headers.Authorization = "Bearer " + Token(role, DateTime.UtcNow.AddMinutes(5));
        var factory = new TestHttpClientFactory(handler);
        var config = Configuration();
        var auth = new EspacesApiAuthorization(factory, new HttpContextAccessor { HttpContext = context }, config);
        return auth;
    }

    private static IConfiguration Configuration() => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:Key"] = Secret, ["ServiceEndpoints:EspacesApi"] = "http://espaces.test/" })
        .Build();

    private static ClaimsPrincipal ParentPrincipal() => Principal("Parent", [new Claim("sub", "parent-1")]);
    private static ClaimsPrincipal ChildPrincipal(Guid id) => Principal("Enfant", [new Claim("sub", id.ToString()), new Claim("espaceId", id.ToString())]);
    private static ClaimsPrincipal Principal(string role, IEnumerable<Claim> claims) =>
        new(new ClaimsIdentity(claims.Append(new Claim("role", role)), "Bearer", "sub", "role"));

    private static string Token(string role, DateTime expires) => new JwtSecurityTokenHandler().WriteToken(
        new JwtSecurityToken(
            claims: [new Claim("sub", "test-user"), new Claim("role", role)],
            expires: expires,
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Secret)), SecurityAlgorithms.HmacSha256)));

    private sealed class TestHttpClientFactory(StubHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> response) : HttpMessageHandler
    {
        public Func<HttpRequestMessage, HttpResponseMessage> Response { get; set; } = response;
        public int RequestCount { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestCount++;
            return Task.FromResult(Response(request));
        }
    }
}
