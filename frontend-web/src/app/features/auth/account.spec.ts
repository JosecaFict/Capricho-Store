import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { UserResponse } from '../../core/models/auth.model';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { Order } from '../../core/models/commerce.model';
import { CommerceService } from '../../core/services/commerce.service';
import { Account } from './account';

const MOCK_USER: UserResponse = {
  id_usuario: 42,
  nombres: 'Flabia',
  apellidos: 'Dominguez',
  correo: 'flabia@gmail.com',
  telefono: '78970000',
  ci: '78979879',
  estado: 'ACTIVO',
  created_at: '2026-01-01T00:00:00Z',
  roles: ['CLIENTE'],
  permisos: [],
  id_sucursal: null,
  sucursal: 'Capricho Central',
};

const MOCK_ORDERS: Order[] = [
  {
    id_pedido: 101,
    id_venta: 501,
    id_cliente: 42,
    cliente_nombre: 'Flabia Dominguez',
    cliente_correo: 'flabia@gmail.com',
    estado: 'LISTO_PARA_RETIRAR',
    modalidad_entrega: 'RETIRO_SUCURSAL',
    id_sucursal: 1,
    sucursal: 'Capricho Store Central',
    direccion_sucursal: '2do Anillo La Pirai',
    id_direccion: null,
    direccion_entrega: null,
    total: '180.00',
    fecha_creacion: '2026-09-19T10:00:00Z',
    fecha_preparacion: '2026-09-19T10:30:00Z',
    fecha_finalizacion: null,
    items: [],
  },
  {
    id_pedido: 102,
    id_venta: 502,
    id_cliente: 42,
    cliente_nombre: 'Flabia Dominguez',
    cliente_correo: 'flabia@gmail.com',
    estado: 'EN_CAMINO',
    modalidad_entrega: 'DELIVERY',
    id_sucursal: 1,
    sucursal: 'Capricho Store Central',
    direccion_sucursal: '2do Anillo La Pirai',
    id_direccion: 5,
    direccion_entrega: 'Av. San Martín #450',
    total: '240.00',
    fecha_creacion: '2026-09-18T14:00:00Z',
    fecha_preparacion: '2026-09-18T14:30:00Z',
    fecha_finalizacion: null,
    items: [],
  },
];

describe('Account Component', () => {
  it('renders customer profile information, monogram avatar, and metrics', () => {
    const currentUserSig = signal<UserResponse | null>(MOCK_USER);
    const authMock = {
      currentUser: currentUserSig,
      logout: vi.fn(),
    };
    const permissionsMock = {
      hasAdminAccess: vi.fn(() => false),
    };
    const commerceMock = {
      orders: vi.fn(() => of(MOCK_ORDERS)),
      reservations: vi.fn(() => of([])),
      addresses: vi.fn(() => of([{ id_direccion: 1, activo: true }])),
      notifications: vi.fn(() => of([
        { id_notificacion: 1, estado: 'ENVIADO' },
        { id_notificacion: 2, estado: 'LEIDO' },
      ])),
      orderInvoice: vi.fn(() => of(new Blob(['pdf content'], { type: 'application/pdf' }))),
    };

    TestBed.configureTestingModule({
      imports: [Account],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
        { provide: PermissionService, useValue: permissionsMock },
        { provide: CommerceService, useValue: commerceMock },
      ],
    });

    const fixture = TestBed.createComponent(Account);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    // Check avatar monogram "FD"
    const avatar = compiled.querySelector('.account-avatar');
    expect(avatar?.textContent?.trim()).toBe('FD');

    // Check greeting
    expect(compiled.querySelector('h1')?.textContent).toContain('Flabia');

    // Check user profile data in list
    expect(compiled.textContent).toContain('flabia@gmail.com');
    expect(compiled.textContent).toContain('78970000');
    expect(compiled.textContent).toContain('78979879');
    expect(compiled.textContent).toContain('Capricho Central');

    // Check recent orders are rendered
    const orderItems = compiled.querySelectorAll('.account-order-item');
    expect(orderItems.length).toBe(2);
    expect(compiled.textContent).toContain('Pedido #101');
    expect(compiled.textContent).toContain('Pedido #102');
    expect(compiled.textContent).toContain('Retiro en tienda');
    expect(compiled.textContent).toContain('Delivery a domicilio');
  });

  it('redirects admin users to /admin/perfil', () => {
    const authMock = {
      currentUser: signal<UserResponse | null>({ ...MOCK_USER, roles: ['ADMINISTRADOR'] }),
      logout: vi.fn(),
    };
    const permissionsMock = {
      hasAdminAccess: vi.fn(() => true),
    };
    const commerceMock = {
      orders: vi.fn(() => of([])),
      reservations: vi.fn(() => of([])),
      addresses: vi.fn(() => of([])),
      notifications: vi.fn(() => of([])),
    };

    TestBed.configureTestingModule({
      imports: [Account],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
        { provide: PermissionService, useValue: permissionsMock },
        { provide: CommerceService, useValue: commerceMock },
      ],
    });

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    TestBed.createComponent(Account);
    expect(navigateSpy).toHaveBeenCalledWith(['/admin/perfil'], { replaceUrl: true });
  });

  it('shows empty orders state when client has no past orders', () => {
    const authMock = {
      currentUser: signal<UserResponse | null>(MOCK_USER),
      logout: vi.fn(),
    };
    const permissionsMock = {
      hasAdminAccess: vi.fn(() => false),
    };
    const commerceMock = {
      orders: vi.fn(() => of([])),
      reservations: vi.fn(() => of([])),
      addresses: vi.fn(() => of([])),
      notifications: vi.fn(() => of([])),
    };

    TestBed.configureTestingModule({
      imports: [Account],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
        { provide: PermissionService, useValue: permissionsMock },
        { provide: CommerceService, useValue: commerceMock },
      ],
    });

    const fixture = TestBed.createComponent(Account);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.account-empty-orders')).toBeTruthy();
    expect(compiled.textContent).toContain('Aún no has realizado pedidos');
  });
});
