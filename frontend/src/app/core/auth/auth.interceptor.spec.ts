import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../api/api-error';
import { childToken, parentToken } from '../testing/jwt-factory';
import { requestContext } from './auth-context';
import { authInterceptor } from './auth.interceptor';
import { SessionService } from './session.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: SessionService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => backend.verify());

  it('attaches the token of the requested audience only', async () => {
    const parent = session.startParentSession(parentToken(), 'p@test.fr');
    const child = session.startChildSession(childToken(), 'Adam');

    const a = firstValueFrom(http.get('/p', { context: requestContext({ service: 'espaces', audience: 'parent' }) }));
    const parentRequest = backend.expectOne('/p');
    expect(parentRequest.request.headers.get('Authorization')).toBe(`Bearer ${parent.token}`);
    parentRequest.flush({});
    await a;

    const b = firstValueFrom(http.get('/c', { context: requestContext({ service: 'espaces', audience: 'child' }) }));
    const req = backend.expectOne('/c');
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${child.token}`);
    req.flush({});
    await b;

    const c = firstValueFrom(http.get('/anon', { context: requestContext({ service: 'espaces' }) }));
    const anon = backend.expectOne('/anon');
    expect(anon.request.headers.has('Authorization')).toBe(false);
    anon.flush({});
    await c;
  });

  it('ends the session on 401 from a session-bound service', async () => {
    session.startParentSession(parentToken(), 'p@test.fr');
    const call = firstValueFrom(
      http.get('/espaces', { context: requestContext({ service: 'espaces', audience: 'parent', sessionBound: true }) }),
    );
    backend.expectOne('/espaces').flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(call).rejects.toBeInstanceOf(ApiError);
    expect(session.isParentAuthenticated()).toBe(false);
  });

  it('keeps the session when a non-integrated service answers 401', async () => {
    session.startParentSession(parentToken(), 'p@test.fr');
    const call = firstValueFrom(
      http.get('/activites', { context: requestContext({ service: 'activites', audience: 'parent' }) }),
    );
    backend.expectOne('/activites').flush(null, { status: 401, statusText: 'Unauthorized' });
    const error = await call.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect(session.isParentAuthenticated()).toBe(true);
  });

  it('fails fast without calling the API when the session is missing', async () => {
    const call = firstValueFrom(
      http.get('/espaces', { context: requestContext({ service: 'espaces', audience: 'parent', sessionBound: true }) }),
    );
    await expect(call).rejects.toBeInstanceOf(ApiError);
    backend.expectNone('/espaces');
  });
});
