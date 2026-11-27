using System.Text;
using Espaces.Api;
using EduKids.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<EspacesDbContext>(o =>
    o.UseSqlite(builder.Configuration.GetConnectionString("Espaces") ?? "Data Source=espaces.db"));
builder.Services.AddControllers();

var cle = builder.Configuration["Jwt:Key"]!;
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(cle));

builder.Services.AddEduKidsJwtBearer(builder.Configuration);
builder.Services.AddAuthorization();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
    scope.ServiceProvider.GetRequiredService<EspacesDbContext>().Database.EnsureCreated();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
