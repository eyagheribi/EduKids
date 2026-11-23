using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Espaces.Api.Controllers;

[ApiController]
[Route("mon-espace")]
[Authorize(Roles = "Enfant")]
public class MonEspaceController : ControllerBase
{
    private readonly EspacesDbContext _db;
    public MonEspaceController(EspacesDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        if (!Guid.TryParse(User.FindFirstValue("espaceId"), out var espaceId))
            return Unauthorized();

        var e = await _db.Espaces.FindAsync(espaceId);
        if (e is null) return NotFound();

        return Ok(new
        {
            e.NomEnfant,
            e.Avatar,
            e.PersonnagePrefere,
            Activites = e.TypesActivites.Split(',', StringSplitOptions.RemoveEmptyEntries)
        });
    }
}