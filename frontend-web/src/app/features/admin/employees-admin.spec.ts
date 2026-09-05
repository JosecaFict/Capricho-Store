import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiErrorService } from '../../core/services/api-error.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { AdminApiService } from './admin-api.service';
import { EmployeeDetail, EmployeesAdmin } from './employees-admin';

const employee = {
  id_empleado: 7,
  nombres: 'Ana',
  apellidos: 'Rojas',
  correo: 'ana@example.com',
  sucursal: 'Central',
  estado_laboral: 'ACTIVO',
  ci: '123',
  fecha_contratacion: '2026-08-30',
  roles: ['CAJERO'],
};

const permissions = [
  { id_permiso: 1, nombre: 'Ver productos', codigo: 'productos.ver', modulo: 'CATALOGO' },
  { id_permiso: 2, nombre: 'Crear ventas', codigo: 'ventas.crear', modulo: 'VENTAS' },
  { id_permiso: 3, nombre: 'Ver empleados', codigo: 'empleados.ver', modulo: 'PERSONAL' },
];

const summary = {
  roles_asignados: ['CAJERO'],
  permisos_heredados: ['productos.ver', 'ventas.crear'],
  permisos_individuales_otorgados: ['empleados.ver'],
  permisos_individuales_revocados: ['ventas.crear'],
  permisos_efectivos: ['productos.ver', 'empleados.ver'],
};

describe('EmployeeDetail permissions', () => {
  it('shows effective access and the three override states', () => {
    const api = {
      get: vi.fn((path: string) => of(path.endsWith('/permissions') ? summary : employee)),
      list: vi.fn((path: string) => of(path === 'permissions' ? permissions : [])),
      put: vi.fn(() => of(summary)),
      delete: vi.fn(() => of(summary)),
    };

    TestBed.configureTestingModule({
      imports: [EmployeeDetail],
      providers: [
        { provide: AdminApiService, useValue: api },
        { provide: PermissionService, useValue: { has: () => true } },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '7' } } },
        },
      ],
    });

    const fixture = TestBed.createComponent(EmployeeDetail);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Según rol');
    expect(text).toContain('Concesión individual');
    expect(text).toContain('Revocación individual');
    expect(text).toContain('✓ Permitido');
    expect(text).toContain('⊘ Denegado');
    expect(fixture.componentInstance.permissionGroups()).toHaveLength(3);
  });
});

describe('EmployeesAdmin role filters', () => {
  it('shows readable role types and filters the employee list', () => {
    const employees = [
      employee,
      {
        ...employee,
        id_empleado: 8,
        nombres: 'Luis',
        correo: 'luis@example.com',
        roles: ['ADMIN'],
      },
    ];
    const api = {
      list: vi.fn((path: string) => of(path === 'employees' ? employees : [])),
    };

    TestBed.configureTestingModule({
      imports: [EmployeesAdmin],
      providers: [
        provideRouter([]),
        { provide: AdminApiService, useValue: api },
        { provide: PermissionService, useValue: { has: () => true } },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });

    const fixture = TestBed.createComponent(EmployeesAdmin);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Administrador');
    expect(element.textContent).toContain('Cajero');

    fixture.componentInstance.roleFilter.set('ADMIN');
    fixture.detectChanges();

    expect(fixture.componentInstance.filteredEmployees()).toHaveLength(1);
    expect(element.textContent).toContain('Luis');
    expect(element.textContent).not.toContain('Ana Rojas');
  });
});
