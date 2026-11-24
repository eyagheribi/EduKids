import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { requestContext } from '../auth/auth-context';
import {
  LoginRequest,
  LoginResponse,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
} from '../models/comptes.models';

/** HTTP client of Comptes.Api (parent accounts). */
@Injectable({ providedIn: 'root' })
export class ComptesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_CONFIG).services.comptes;

  register(body: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.base}/auth/register`, body, {
      context: requestContext({ service: 'comptes' }),
    });
  }

  login(body: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/auth/login`, body, {
      context: requestContext({ service: 'comptes' }),
    });
  }

  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.base}/auth/me`, {
      context: requestContext({ service: 'comptes', audience: 'parent', sessionBound: true }),
    });
  }
}
