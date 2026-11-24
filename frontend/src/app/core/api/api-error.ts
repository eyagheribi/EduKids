import { HttpErrorResponse } from '@angular/common/http';
import { SERVICE_LABELS, ServiceName } from '../config/app-config';

/**
 * Normalized error raised by every gateway. `message` is always user-facing French text.
 * Components display `message` (and optionally `details`) — never raw HTTP errors.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status (0 = network / service unreachable). */
    readonly status: number,
    readonly service: ServiceName | null = null,
    /** Extra user-facing messages (validation errors…). */
    readonly details: readonly string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Extracts a user-facing message from anything thrown by a gateway. */
export function errorMessage(error: unknown, fallback = 'Une erreur inattendue est survenue.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// ASP.NET Identity (Comptes.Api) returns English descriptions — translated here.
const IDENTITY_TRANSLATIONS: readonly [RegExp, string][] = [
  [/Passwords must be at least (\d+) characters/i, 'Le mot de passe doit contenir au moins $1 caractères.'],
  [/Passwords must have at least one digit/i, 'Le mot de passe doit contenir au moins un chiffre.'],
  [/Passwords must have at least one lowercase/i, 'Le mot de passe doit contenir au moins une lettre minuscule.'],
  [/Passwords must have at least one uppercase/i, 'Le mot de passe doit contenir au moins une lettre majuscule.'],
  [/Passwords must have at least one non alphanumeric/i, 'Le mot de passe doit contenir au moins un caractère spécial.'],
  [/Passwords must use at least (\d+) different characters/i, 'Le mot de passe doit contenir au moins $1 caractères différents.'],
  [/Username '.*' is already taken/i, 'Cette adresse e-mail est déjà utilisée par un autre compte.'],
  [/Email '.*' is already taken/i, 'Cette adresse e-mail est déjà utilisée par un autre compte.'],
  [/Username '.*' is invalid/i, 'Cette adresse e-mail contient des caractères non autorisés.'],
  [/Email '.*' is invalid/i, 'Adresse e-mail invalide.'],
  [/The (\w+) field is required/i, 'Le champ « $1 » est obligatoire.'],
];

export function translateBackendMessage(message: string): string {
  for (const [pattern, replacement] of IDENTITY_TRANSLATIONS) {
    const match = message.match(pattern);
    if (match) return replacement.replace(/\$(\d)/g, (_, index: string) => match[Number(index)] ?? '');
  }
  return message;
}

function collectMessages(body: unknown): string[] {
  if (body == null) return [];
  if (typeof body === 'string') {
    const text = body.trim();
    if (!text || text.startsWith('<')) return [];
    // Plain-text bodies (Espaces.Api) may be JSON-quoted strings.
    if (text.startsWith('"') && text.endsWith('"')) {
      try {
        return [String(JSON.parse(text))];
      } catch {
        return [text];
      }
    }
    return [text];
  }
  if (Array.isArray(body)) {
    return body.flatMap((item) =>
      typeof item === 'string' ? [item] : typeof item?.description === 'string' ? [item.description] : [],
    );
  }
  if (typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    const messages: string[] = [];
    const errors = obj['errors'];
    if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
      for (const value of Object.values(errors as Record<string, unknown>)) {
        if (Array.isArray(value)) messages.push(...value.filter((v): v is string => typeof v === 'string'));
      }
    } else if (Array.isArray(errors)) {
      messages.push(...collectMessages(errors));
    }
    // ProblemDetails: Activites.Api / Suivi.Api put the domain message in "title".
    const title = obj['title'];
    if (!messages.length && typeof title === 'string' && !/^One or more validation errors/i.test(title)) {
      messages.push(title);
    }
    const detail = obj['detail'];
    if (!messages.length && typeof detail === 'string' && detail.length < 300) messages.push(detail);
    return messages;
  }
  return [];
}

function defaultMessage(status: number, service: ServiceName | null): string {
  const label = service ? SERVICE_LABELS[service] : 'le service';
  switch (status) {
    case 0:
      return `Impossible de joindre ${label}. Vérifiez que le service est démarré et réessayez.`;
    case 400:
      return 'La demande contient des informations invalides.';
    case 401:
      return 'Authentification requise ou refusée.';
    case 403:
      return 'Accès refusé.';
    case 404:
      return 'Élément introuvable.';
    case 409:
      return 'Cette action est impossible pour le moment (conflit).';
    case 502:
    case 503:
    case 504:
      return `${label} est momentanément indisponible. Réessayez dans un instant.`;
    default:
      return status >= 500 ? `${label} a rencontré une erreur interne.` : 'Une erreur inattendue est survenue.';
  }
}

/** Converts an HttpErrorResponse into an ApiError with French, user-facing messages. */
export function toApiError(error: unknown, service: ServiceName | null): ApiError {
  if (error instanceof ApiError) return error;
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError(errorMessage(error), -1, service);
  }
  // The Angular dev-server proxy answers 500/504 with an HTML/empty body when the target is down.
  const proxyDown =
    (error.status === 504 || error.status === 502 || error.status === 500) &&
    (typeof error.error !== 'object' || error.error === null) &&
    !collectMessages(error.error).length;
  const status = proxyDown ? 0 : error.status;
  const messages = collectMessages(error.error).map(translateBackendMessage);
  const unique = [...new Set(messages)];
  const message = unique[0] ?? defaultMessage(status, service);
  return new ApiError(message, status, service, unique.slice(1));
}
