using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Espaces.Api.Controllers;

[ApiController]
[Route("espaces")]
[Authorize(Roles = "Parent")]
public class EspacesController : ControllerBase
{
    private readonly EspacesDbContext _db;
    private static readonly string[] TypesValides = { "Dictee", "Maths", "Association" };

    public EspacesController(EspacesDbContext db) => _db = db;

    [HttpPost]
    public async Task<IActionResult> Creer(CreerEspaceDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.NomEnfant))
            return BadRequest("Le nom de l'enfant est obligatoire.");

        if (dto.Activites.Count == 0 || dto.Activites.Any(a => !TypesValides.Contains(a)))
            return BadRequest("Types valides : Dictee, Maths, Association.");

        var espace = new EspaceEnfant
        {
            ParentId = User.FindFirstValue("sub")!,
            NomEnfant = dto.NomEnfant.Trim(),
            CodeAcces = await GenererCode(),
            TypesActivites = string.Join(",", dto.Activites.Distinct())
        };

        _db.Espaces.Add(espace);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            espace.Id,
            espace.NomEnfant,
            espace.CodeAcces,
            Activites = dto.Activites.Distinct()
        });
    }

    [HttpGet]
    public async Task<IActionResult> Lister()
    {
        var parentId = User.FindFirstValue("sub");
        var espaces = await _db.Espaces
            .Where(e => e.ParentId == parentId)
            .Select(e => new { e.Id, e.NomEnfant, e.CodeAcces, e.TypesActivites })
            .ToListAsync();
        return Ok(espaces);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Detail(Guid id)
    {
        var parentId = User.FindFirstValue("sub");
        var e = await _db.Espaces.FirstOrDefaultAsync(x => x.Id == id && x.ParentId == parentId);
        if (e is null) return NotFound();

        return Ok(new
        {
            e.Id,
            e.NomEnfant,
            e.CodeAcces,
            e.Avatar,
            e.PersonnagePrefere,
            Activites = e.TypesActivites.Split(',', StringSplitOptions.RemoveEmptyEntries)
        });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Modifier(Guid id, ModifierEspaceDto dto)
    {
        var parentId = User.FindFirstValue("sub");
        var e = await _db.Espaces.FirstOrDefaultAsync(x => x.Id == id && x.ParentId == parentId);
        if (e is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(dto.NomEnfant))
            e.NomEnfant = dto.NomEnfant.Trim();

        if (dto.Avatar is not null)
            e.Avatar = dto.Avatar;

        if (dto.Activites is not null)
        {
            if (dto.Activites.Count == 0 || dto.Activites.Any(a => !TypesValides.Contains(a)))
                return BadRequest("Types valides : Dictee, Maths, Association.");
            e.TypesActivites = string.Join(",", dto.Activites.Distinct());
        }

        await _db.SaveChangesAsync();
        return Ok(new { e.Id, e.NomEnfant, e.Avatar, Activites = e.TypesActivites.Split(',') });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Supprimer(Guid id)
    {
        var parentId = User.FindFirstValue("sub");
        var e = await _db.Espaces.FirstOrDefaultAsync(x => x.Id == id && x.ParentId == parentId);
        if (e is null) return NotFound();

        _db.Espaces.Remove(e);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<string> GenererCode()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        while (true)
        {
            var code = new string(Enumerable.Range(0, 6)
                .Select(_ => alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)])
                .ToArray());

            if (!await _db.Espaces.AnyAsync(e => e.CodeAcces == code))
                return code;
        }
    }
}

public record CreerEspaceDto(string NomEnfant, List<string> Activites);
public record ModifierEspaceDto(string? NomEnfant, string? Avatar, List<string>? Activites);