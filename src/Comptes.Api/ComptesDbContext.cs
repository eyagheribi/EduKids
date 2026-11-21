using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Comptes.Api;

public class ComptesDbContext : IdentityDbContext<Parent>
{
    public ComptesDbContext(DbContextOptions<ComptesDbContext> options) : base(options) { }
}