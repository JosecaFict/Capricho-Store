import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { CommerceService } from '../../core/services/commerce.service';
import { SiteHeader } from './site-header';

describe('SiteHeader', () => {
  function setup(authenticated = true, hasAdmin = true) {
    const userSignal = signal(
      authenticated
        ? {
            id_usuario: 1,
            nombres: 'José Carlos',
            apellidos: 'Villarroel Dueñas',
            correo: 'jose@capricho.com',
            estado: 'ACTIVO' as const,
            roles: hasAdmin ? ['ADMIN'] : ['CLIENTE'],
            permisos: hasAdmin ? ['admin.total', 'productos.ver'] : [],
            sucursal: null,
            telefono: null,
            ci: null,
            created_at: '2026-01-01',
          }
        : null,
    );

    const authServiceMock = {
      currentUser: userSignal,
      restoreSession: vi.fn(),
      logout: vi.fn(),
    };

    const permissionServiceMock = {
      hasAdminAccess: signal(hasAdmin),
      has: vi.fn((perm: string) => hasAdmin),
      hasAny: vi.fn((perms: readonly string[]) => hasAdmin),
    };

    const commerceServiceMock = {
      notifications: vi.fn(() => of([])),
    };

    TestBed.configureTestingModule({
      imports: [SiteHeader],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
        { provide: PermissionService, useValue: permissionServiceMock },
        { provide: CommerceService, useValue: commerceServiceMock },
      ],
    });

    const fixture = TestBed.createComponent(SiteHeader);
    fixture.detectChanges();

    return { fixture, component: fixture.componentInstance, authServiceMock };
  }

  it('hides Carrito, renders briefcase Panel badge and links Mi cuenta to /admin/perfil for admin staff', () => {
    const { fixture } = setup(true, true);

    const links = fixture.debugElement.queryAll(By.css('a'));
    const linkTexts = links.map((l) => l.nativeElement.textContent.trim());

    // Admin should NOT see Carrito
    expect(linkTexts).not.toContain('Carrito');

    // Admin should see briefcase Panel badge pointing to /admin
    const adminBadge = fixture.debugElement.query(By.css('.nav-admin-badge'));
    expect(adminBadge).toBeTruthy();
    expect(adminBadge.attributes['routerLink']).toBe('/admin');
    expect(adminBadge.nativeElement.textContent).toContain('Panel');

    // Mi cuenta should point to /admin/perfil
    const myAccountLink = links.find((l) => l.nativeElement.textContent.trim() === 'Mi cuenta');
    expect(myAccountLink).toBeTruthy();
    expect(myAccountLink?.attributes['routerLink']).toBe('/admin/perfil');
  });

  it('renders Carrito, hides Panel badge and links Mi cuenta to /cuenta for regular customers', () => {
    const { fixture } = setup(true, false);

    const links = fixture.debugElement.queryAll(By.css('a'));
    const linkTexts = links.map((l) => l.nativeElement.textContent.trim());

    // Customer SHOULD see Carrito
    expect(linkTexts).toContain('Carrito');

    // Customer should NOT see the admin badge
    const adminBadge = fixture.debugElement.query(By.css('.nav-admin-badge'));
    expect(adminBadge).toBeNull();

    // Customer Mi cuenta should point to /cuenta
    const myAccountLink = links.find((l) => l.nativeElement.textContent.trim() === 'Mi cuenta');
    expect(myAccountLink).toBeTruthy();
    expect(myAccountLink?.attributes['routerLink']).toBe('/cuenta');
  });

  it('renders Ingresar and Crear cuenta for unauthenticated visitors', () => {
    const { fixture } = setup(false, false);

    const links = fixture.debugElement.queryAll(By.css('a'));
    const linkTexts = links.map((l) => l.nativeElement.textContent.trim());

    expect(linkTexts).toContain('Ingresar');
    expect(linkTexts).toContain('Crear cuenta');
    expect(linkTexts).not.toContain('Carrito');
    expect(linkTexts).not.toContain('Mi cuenta');
  });
});
