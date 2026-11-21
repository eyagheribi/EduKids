using Microsoft.AspNetCore.Identity;

namespace Comptes.Api;

public class Parent : IdentityUser
{
    public string Nom { get; set; } = "";
    public string Prenom { get; set; } = "";
}