using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace Espaces.Api.Controllers;

[ApiController]
[Route("acces")]
public class AccesController : ControllerBase
{
    private readonly EspacesDbContext _db;
    private readonly IConfiguration _config;

    public AccesController(EspacesDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    [HttpPost("code")]
    public async Task<IActionResult> Code(CodeDto dto)
    {
        var code = (dto.Code ?? "").Trim().ToUpperInvariant();
        var espace = await _db.Espaces.FirstOrDefaultAsync(e => e.CodeAcces == code);
        if (espace is null)
            return Unauthorized("Code invalide.");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var token = new JwtSecurityToken(
            claims: new[]
            {
                new Claim("sub", espace.Id.ToString()),
                new Claim("role", "Enfant"),
                new Claim("espaceId", espace.Id.ToString())
            },
            expires: DateTime.UtcNow.AddHours(4),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return Ok(new
        {
            token = new JwtSecurityTokenHandler().WriteToken(token),
            espace.NomEnfant
        });
    }
}

public record CodeDto(string Code);