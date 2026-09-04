import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from './token-storage.service';

function tokenWithExpiration(exp: number): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.signature`;
}

describe('TokenStorageService', () => {
  let service: TokenStorageService;

  beforeEach(() => {
    localStorage.clear();
    service = TestBed.inject(TokenStorageService);
  });

  it('stores and returns a valid access token', () => {
    const token = tokenWithExpiration(Math.floor(Date.now() / 1000) + 600);
    service.set(token);
    expect(service.get()).toBe(token);
  });

  it('removes an expired access token', () => {
    service.set(tokenWithExpiration(Math.floor(Date.now() / 1000) - 10));
    expect(service.get()).toBeNull();
    expect(localStorage.getItem('capricho_access_token')).toBeNull();
  });

  it('rejects malformed tokens', () => {
    service.set('not-a-jwt');
    expect(service.get()).toBeNull();
  });
});
