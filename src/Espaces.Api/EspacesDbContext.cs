using Microsoft.EntityFrameworkCore;

namespace Espaces.Api;

public class EspacesDbContext : DbContext
{
    public EspacesDbContext(DbContextOptions<EspacesDbContext> options) : base(options) { }

    public DbSet<EspaceEnfant> Espaces => Set<EspaceEnfant>();
}