using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EduKids.Contracts
{
    // Envoyé par Suivi quand l'enfant a terminé une activité
    public record ActiviteTerminee(
        Guid EspaceEnfantId,
        Guid ParentId,
        string NomEnfant,
        string TitreActivite,
        float Score,
        int EtoilesGagnees);

    // Envoyé par Suivi quand le bocal est plein
    public record BocalPlein(
        Guid EspaceEnfantId,
        Guid ParentId,
        string NomEnfant,
        string Recompense);

    // Envoyé par Espaces quand le parent supprime un espace enfant
    public record EspaceEnfantSupprime(Guid EspaceEnfantId);

    // Envoyé par Activites quand le parent supprime une activité
    public record ActiviteSupprimee(Guid ActiviteId);
}
