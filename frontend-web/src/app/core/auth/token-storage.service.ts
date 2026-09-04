import { Injectable } from '@angular/core';

interface JwtPayload {
  exp?: number;
  sub?: string;
}

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly key = 'capricho_access_token';

  get(): string | null {
    if (typeof localStorage === 'undefined') return null;
    const token = localStorage.getItem(this.key);
    if (token && this.isExpired(token)) {
      this.clear();
      return null;
    }
    return token;
  }

  set(token: string): void {
    localStorage.setItem(this.key, token);
  }

  clear(): void {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(this.key);
  }

  isExpired(token: string): boolean {
    const payload = this.decode(token);
    return !payload?.exp || payload.exp * 1000 <= Date.now();
  }

  private decode(token: string): JwtPayload | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(normalized)) as JwtPayload;
    } catch {
      return null;
    }
  }
}
