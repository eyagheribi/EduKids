import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, toApiError, translateBackendMessage } from './api-error';

describe('toApiError', () => {
  const http = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

  it('translates ASP.NET Identity errors (Comptes.Api register)', () => {
    const error = toApiError(
      http(400, [
        'Passwords must be at least 6 characters.',
        "Passwords must have at least one digit ('0'-'9').",
        "Passwords must have at least one uppercase ('A'-'Z').",
      ]),
      'comptes',
    );
    expect(error.message).toBe('Le mot de passe doit contenir au moins 6 caractères.');
    expect(error.details).toEqual([
      'Le mot de passe doit contenir au moins un chiffre.',
      'Le mot de passe doit contenir au moins une lettre majuscule.',
    ]);
  });

  it('translates duplicate accounts', () => {
    expect(translateBackendMessage("Username 'a@b.fr' is already taken.")).toBe(
      'Cette adresse e-mail est déjà utilisée par un autre compte.',
    );
  });

  it('keeps plain-text bodies (Espaces.Api)', () => {
    const error = toApiError(http(401, 'Code invalide.'), 'espaces');
    expect(error.message).toBe('Code invalide.');
    expect(error.status).toBe(401);
  });

  it('reads ProblemDetails titles (Activites.Api)', () => {
    const error = toApiError(http(409, { title: 'Cette session est terminée.', status: 409 }), 'activites');
    expect(error.message).toBe('Cette session est terminée.');
    expect(error.isConflict).toBe(true);
  });

  it('reads ValidationProblemDetails errors', () => {
    const error = toApiError(
      http(400, {
        title: 'One or more validation errors occurred.',
        errors: { NomEnfant: ['The NomEnfant field is required.'] },
      }),
      'espaces',
    );
    expect(error.message).toBe('Le champ « NomEnfant » est obligatoire.');
  });

  it('reports unreachable services in French', () => {
    const error = toApiError(http(0, null), 'suivi');
    expect(error.isNetworkError).toBe(true);
    expect(error.message).toContain('Suivi.Api');
  });

  it('treats dev-proxy gateway errors without body as unreachable service', () => {
    const error = toApiError(http(504, ''), 'espaces');
    expect(error.status).toBe(0);
  });

  it('returns ApiError instances unchanged', () => {
    const original = new ApiError('x', 418, 'comptes');
    expect(toApiError(original, null)).toBe(original);
  });
});
