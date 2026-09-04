import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { UserResponse } from '../models/auth.model';
import { PermissionService } from './permission.service';

const baseUser: UserResponse = {
  id_usuario: 7,
  nombres: 'Ana',
  apellidos: 'Rojas',
  correo: 'ana@example.com',
  telefono: null,
  ci: null,
  estado: 'ACTIVO',
  created_at: '2026-08-31T00:00:00Z',
  roles: ['AUXILIAR_INVENTARIO'],
  permisos: ['inventario.ver'],
};

describe('PermissionService', () => {
  it('usa exclusivamente los permisos efectivos de /auth/me', () => {
    const currentUser = signal<UserResponse | null>(baseUser);
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { currentUser } }],
    });
    const service = TestBed.inject(PermissionService);
    expect(service.has('inventario.ver')).toBe(true);
    expect(service.has('inventario.movimiento')).toBe(false);
    expect(service.hasAdminAccess()).toBe(true);
  });

  it('no concede acceso administrativo por el nombre del rol', () => {
    const currentUser = signal<UserResponse | null>({
      ...baseUser,
      roles: ['ADMIN'],
      permisos: [],
    });
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { currentUser } }],
    });
    const service = TestBed.inject(PermissionService);
    expect(service.hasAdminAccess()).toBe(false);
  });
});
