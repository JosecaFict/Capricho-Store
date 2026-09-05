import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  LoginRequest,
  MessageResponse,
  PasswordRecoveryRequest,
  PasswordRecoveryVerifyRequest,
  PasswordRecoveryVerifyResponse,
  PasswordResetRequest,
  RegisterRequest,
  TokenResponse,
  UserResponse,
} from '../models/auth.model';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly currentUserState = signal<UserResponse | null>(null);
  private readonly loadingState = signal(false);

  readonly currentUser = this.currentUserState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly isAuthenticated = computed(() => !!this.currentUserState() && !!this.tokenStorage.get());

  register(payload: RegisterRequest): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${API_BASE_URL}/auth/register`, payload);
  }

  login(payload: LoginRequest): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${API_BASE_URL}/auth/login`, payload)
      .pipe(tap((response) => this.tokenStorage.set(response.access_token)));
  }

  requestPasswordRecovery(payload: PasswordRecoveryRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${API_BASE_URL}/auth/password-recovery/request`,
      payload,
    );
  }

  verifyPasswordRecoveryCode(
    payload: PasswordRecoveryVerifyRequest,
  ): Observable<PasswordRecoveryVerifyResponse> {
    return this.http.post<PasswordRecoveryVerifyResponse>(
      `${API_BASE_URL}/auth/password-recovery/verify`,
      payload,
    );
  }

  resetPassword(payload: PasswordResetRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${API_BASE_URL}/auth/password-recovery/reset`, payload);
  }

  loadCurrentUser(): Observable<UserResponse> {
    this.loadingState.set(true);
    return this.http.get<UserResponse>(`${API_BASE_URL}/auth/me`).pipe(
      tap({
        next: (user) => {
          this.currentUserState.set(user);
          this.loadingState.set(false);
        },
        error: () => this.loadingState.set(false),
      }),
    );
  }

  restoreSession(): void {
    if (!this.tokenStorage.get() || this.currentUserState() || this.loadingState()) return;
    this.loadCurrentUser().subscribe({ error: () => this.logout() });
  }

  token(): string | null {
    return this.tokenStorage.get();
  }

  logout(): void {
    this.tokenStorage.clear();
    this.currentUserState.set(null);
  }
}
