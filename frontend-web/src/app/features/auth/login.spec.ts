import { UserResponse } from '../../core/models/auth.model';
import { resolveLoginDestination } from './login';

const baseUser: UserResponse = {
  id_usuario: 1,
  nombres: 'Ana',
  apellidos: 'Pérez',
  correo: 'ana@example.com',
  telefono: null,
  ci: null,
  estado: 'ACTIVO',
  created_at: '2026-09-05T00:00:00Z',
  roles: ['CLIENTE'],
  permisos: [],
};

describe('resolveLoginDestination', () => {
  it('sends an administrator to the operational panel', () => {
    const admin = { ...baseUser, roles: ['ADMIN'], permisos: ['empleados.ver'] };

    expect(resolveLoginDestination(admin, null)).toBe('/admin');
  });

  it('sends a customer to their account', () => {
    expect(resolveLoginDestination(baseUser, null)).toBe('/cuenta');
  });

  it('preserves a local return URL', () => {
    expect(resolveLoginDestination(baseUser, '/catalogo')).toBe('/catalogo');
  });

  it('ignores an external return URL', () => {
    expect(resolveLoginDestination(baseUser, '//example.com')).toBe('/cuenta');
  });
});
