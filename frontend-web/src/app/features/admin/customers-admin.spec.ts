import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CommerceService } from '../../core/services/commerce.service';
import {
  CustomerAdminDetail,
  CustomerAdminSummary,
} from '../../core/models/commerce.model';
import { CustomersAdmin } from './customers-admin';

const mockCustomer: CustomerAdminSummary = {
  id_cliente: 1,
  id_usuario: 10,
  nombres: 'María',
  apellidos: 'Pérez',
  nombre_completo: 'María Pérez',
  correo: 'maria@example.com',
  ci: '8472910',
  telefono: '70012345',
  fecha_nacimiento: '1995-08-15',
  estado: 'ACTIVO',
  total_pedidos: 5,
  total_reservas: 2,
  total_ventas: 6,
  created_at: '2026-01-10T12:00:00Z',
  updated_at: '2026-01-10T12:00:00Z',
};

const mockDetail: CustomerAdminDetail = {
  ...mockCustomer,
  direcciones: [
    {
      id_direccion: 101,
      id_ciudad: 1,
      ciudad: 'Santa Cruz de la Sierra',
      departamento: 'Santa Cruz',
      alias: 'Casa',
      zona: 'Equipetrol',
      direccion: 'Calle Los Cusis #45',
      referencia: 'Cerca del parque',
      es_principal: true,
      activo: true,
    },
  ],
};

describe('CustomersAdmin', () => {
  it('loads and displays customers with statistical summary', () => {
    const commerceMock = {
      adminCustomers: vi.fn(() => of([mockCustomer])),
      adminCustomer: vi.fn(() => of(mockDetail)),
      updateAdminCustomer: vi.fn(() => of(mockDetail)),
    };

    TestBed.configureTestingModule({
      imports: [CustomersAdmin],
      providers: [
        { provide: CommerceService, useValue: commerceMock },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });

    const fixture = TestBed.createComponent(CustomersAdmin);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('María Pérez');
    expect(element.textContent).toContain('maria@example.com');
    expect(element.textContent).toContain('8472910');
    expect(element.textContent).toContain('70012345');
    expect(element.textContent).toContain('5 pedidos');
    expect(element.textContent).toContain('2 reservas');
  });

  it('filters customers reactively based on search term and status', () => {
    const customer2: CustomerAdminSummary = {
      ...mockCustomer,
      id_cliente: 2,
      nombres: 'Carlos',
      apellidos: 'Santillán',
      nombre_completo: 'Carlos Santillán',
      correo: 'carlos@example.com',
      ci: '9988776',
      estado: 'INACTIVO',
      total_pedidos: 0,
      total_reservas: 0,
    };

    const commerceMock = {
      adminCustomers: vi.fn(() => of([mockCustomer, customer2])),
      adminCustomer: vi.fn(() => of(mockDetail)),
      updateAdminCustomer: vi.fn(() => of(mockDetail)),
    };

    TestBed.configureTestingModule({
      imports: [CustomersAdmin],
      providers: [
        { provide: CommerceService, useValue: commerceMock },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });

    const fixture = TestBed.createComponent(CustomersAdmin);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    // Initially both customers exist
    expect(component.filteredCustomers().length).toBe(2);

    // Search for "Carlos"
    component.searchTerm.set('Carlos');
    fixture.detectChanges();
    expect(component.filteredCustomers().length).toBe(1);
    expect(component.filteredCustomers()[0].nombre_completo).toBe('Carlos Santillán');

    // Filter by ACTIVO -> should be 0 because Carlos is INACTIVO
    component.statusFilter.set('ACTIVO');
    fixture.detectChanges();
    expect(component.filteredCustomers().length).toBe(0);

    // Filter by INACTIVO -> Carlos matches
    component.statusFilter.set('INACTIVO');
    fixture.detectChanges();
    expect(component.filteredCustomers().length).toBe(1);
  });

  it('opens detail modal and displays address information', () => {
    const commerceMock = {
      adminCustomers: vi.fn(() => of([mockCustomer])),
      adminCustomer: vi.fn(() => of(mockDetail)),
      updateAdminCustomer: vi.fn(() => of(mockDetail)),
    };

    TestBed.configureTestingModule({
      imports: [CustomersAdmin],
      providers: [
        { provide: CommerceService, useValue: commerceMock },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });

    const fixture = TestBed.createComponent(CustomersAdmin);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.viewCustomer(1);
    fixture.detectChanges();

    expect(commerceMock.adminCustomer).toHaveBeenCalledWith(1);
    expect(component.showDetailModal()).toBe(true);

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Perfil de cliente #1');
    expect(element.textContent).toContain('Calle Los Cusis #45');
    expect(element.textContent).toContain('Equipetrol');
  });

  it('opens edit modal and submits updated information including optional password reset', () => {
    const updatedDetail: CustomerAdminDetail = {
      ...mockDetail,
      nombres: 'María Antonieta',
      nombre_completo: 'María Antonieta Pérez',
    };
    const commerceMock = {
      adminCustomers: vi.fn(() => of([mockCustomer])),
      adminCustomer: vi.fn(() => of(mockDetail)),
      updateAdminCustomer: vi.fn(() => of(updatedDetail)),
    };

    TestBed.configureTestingModule({
      imports: [CustomersAdmin],
      providers: [
        { provide: CommerceService, useValue: commerceMock },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });

    const fixture = TestBed.createComponent(CustomersAdmin);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.editCustomer(mockCustomer);
    fixture.detectChanges();

    expect(component.showEditModal()).toBe(true);
    expect(component.editForm.get('nombres')?.value).toBe('María');

    // Update name and assign a new password
    component.editForm.patchValue({
      nombres: 'María Antonieta',
      nuevo_password: 'NewSecurePassword123',
    });

    component.saveCustomer();
    fixture.detectChanges();

    expect(commerceMock.updateAdminCustomer).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        nombres: 'María Antonieta',
        nuevo_password: 'NewSecurePassword123',
      }),
    );
    expect(component.showEditModal()).toBe(false);
    expect(component.message()).toContain('actualizado correctamente');
  });
});
