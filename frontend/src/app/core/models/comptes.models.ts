// Contracts of Comptes.Api (src/Comptes.Api/Program.cs). JSON is camelCase.

/** POST /auth/register body (RegisterDto). */
export interface RegisterRequest {
  readonly email: string;
  readonly motDePasse: string;
  readonly nom: string;
  readonly prenom: string;
}

/** POST /auth/register → 200 { id, email }; 400 → string[] (ASP.NET Identity error descriptions). */
export interface RegisterResponse {
  readonly id: string;
  readonly email: string;
}

/** POST /auth/login body (LoginDto). */
export interface LoginRequest {
  readonly email: string;
  readonly motDePasse: string;
}

/** POST /auth/login → 200 { token } (JWT, 2 h, claims sub + role=Parent); 401 without body. */
export interface LoginResponse {
  readonly token: string;
}

/** GET /auth/me → { id, role }. The API exposes no name/e-mail profile endpoint. */
export interface MeResponse {
  readonly id: string | null;
  readonly role: string | null;
}

/**
 * ASP.NET Identity defaults used by Comptes.Api (only RequireNonAlphanumeric is disabled):
 * 6+ characters, one digit, one lowercase and one uppercase letter.
 */
export const PASSWORD_RULES = {
  minLength: 6,
  requireDigit: true,
  requireLowercase: true,
  requireUppercase: true,
} as const;
