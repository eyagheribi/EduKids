using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Comptes.Api;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<ComptesDbContext>(o => o.UseSqlite("Data Source=comptes.db"));

builder.Services.AddIdentityCore<Parent>(o => o.Password.RequireNonAlphanumeric = false)
    .AddEntityFrameworkStores<ComptesDbContext>();

var cle = builder.Configuration["Jwt:Key"]!;
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(cle));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o => o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        IssuerSigningKey = signingKey,
        NameClaimType = "sub",
        RoleClaimType = "role"
    });
builder.Services.AddAuthorization();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
    scope.ServiceProvider.GetRequiredService<ComptesDbContext>().Database.EnsureCreated();

app.UseAuthentication();
app.UseAuthorization();

// CRÉER UN COMPTE
app.MapPost("/auth/register", async (RegisterDto dto, UserManager<Parent> users) =>
{
    var parent = new Parent
    {
        UserName = dto.Email,
        Email = dto.Email,
        Nom = dto.Nom,
        Prenom = dto.Prenom
    };
    var result = await users.CreateAsync(parent, dto.MotDePasse);
    return result.Succeeded
        ? Results.Ok(new { parent.Id, parent.Email })
        : Results.BadRequest(result.Errors.Select(e => e.Description));
});

// S'AUTHENTIFIER
app.MapPost("/auth/login", async (LoginDto dto, UserManager<Parent> users) =>
{
    var parent = await users.FindByEmailAsync(dto.Email);
    if (parent is null || !await users.CheckPasswordAsync(parent, dto.MotDePasse))
        return Results.Unauthorized();

    var claims = new[]
    {
        new Claim("sub", parent.Id),
        new Claim("role", "Parent")
    };
    var token = new JwtSecurityToken(
        claims: claims,
        expires: DateTime.UtcNow.AddHours(2),
        signingCredentials: new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256));

    return Results.Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token) });
});

// TEST : qui suis-je ?
app.MapGet("/auth/me", (ClaimsPrincipal user) =>
    Results.Ok(new { id = user.FindFirstValue("sub"), role = user.FindFirstValue("role") }))
    .RequireAuthorization();

app.Run();

record RegisterDto(string Email, string MotDePasse, string Nom, string Prenom);
record LoginDto(string Email, string MotDePasse);