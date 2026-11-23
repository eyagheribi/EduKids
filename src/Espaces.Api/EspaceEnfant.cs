namespace Espaces.Api;

public class EspaceEnfant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ParentId { get; set; } = "";
    public string NomEnfant { get; set; } = "";
    public string Avatar { get; set; } = "";
    public string CodeAcces { get; set; } = "";
    public string PersonnagePrefere { get; set; } = "";
    public string TypesActivites { get; set; } = "";
}