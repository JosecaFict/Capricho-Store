import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { AdminDashboardSummary } from '../../core/models/commerce.model';
import { CatalogService } from '../../core/services/catalog.service';
import { CommerceService } from '../../core/services/commerce.service';
import { AdminDashboard } from './dashboard';

const mockBranches = [
  {
    id_sucursal: 1,
    nombre: 'Sucursal Central',
    ciudad: 'Santa Cruz',
    departamento: 'Santa Cruz',
    direccion: 'Calle 1',
    telefono: '70000000',
    hora_apertura: '08:00',
    hora_cierre: '20:00',
    activo: true,
  },
  {
    id_sucursal: 2,
    nombre: 'Sucursal Banzer',
    ciudad: 'Santa Cruz',
    departamento: 'Santa Cruz',
    direccion: 'Av. Banzer',
    telefono: '70000001',
    hora_apertura: '09:00',
    hora_cierre: '21:00',
    activo: true,
  },
];

const mockSummary: AdminDashboardSummary = {
  kpis: {
    ventas_mes_total: 42580.0,
    ventas_crecimiento_pct: 14.8,
    pedidos_pendientes: 12,
    reservas_hoy: 8,
    alertas_stock_critico: 5,
  },
  tendencia_semanal: [
    { fecha: '2026-09-08', dia_nombre: 'Lun', total: 4200.0 },
    { fecha: '2026-09-09', dia_nombre: 'Mar', total: 5100.0 },
    { fecha: '2026-09-10', dia_nombre: 'Mié', total: 6300.0 },
    { fecha: '2026-09-11', dia_nombre: 'Jue', total: 5800.0 },
    { fecha: '2026-09-12', dia_nombre: 'Vie', total: 8200.0 },
    { fecha: '2026-09-13', dia_nombre: 'Sáb', total: 9400.0 },
    { fecha: '2026-09-14', dia_nombre: 'Dom', total: 3580.0 },
  ],
  ventas_por_sucursal: [
    { id_sucursal: 1, nombre: 'Sucursal Central', total: 28400.0, porcentaje: 66.7 },
    { id_sucursal: 2, nombre: 'Sucursal Banzer', total: 14180.0, porcentaje: 33.3 },
  ],
  pedidos_urgentes: [
    {
      id_pedido: 101,
      id_venta: 201,
      cliente_nombre: 'Carla Mendoza',
      tipo_entrega: 'ENVIO_DOMICILIO',
      estado: 'PREPARANDO',
      total: 380.0,
      fecha_creacion: '2026-09-14T10:30:00Z',
    },
  ],
  top_productos: [
    {
      id_producto: 1,
      nombre: 'Vestido Seda Floral',
      categoria: 'Vestidos',
      marca: 'Zara',
      unidades_vendidas: 34,
      total_recaudado: 12240.0,
      imagen_url: 'https://example.com/vestido.jpg',
    },
  ],
};

describe('AdminDashboard', () => {
  function setup(summaryResponse = of(mockSummary)) {
    const authServiceMock = {
      currentUser: signal({
        id_usuario: 1,
        nombres: 'Valeria',
        apellidos: 'Ríos',
        correo: 'valeria@capricho.com',
        estado: 'ACTIVO',
        permisos: ['ventas.ver', 'pedidos.ver', 'reservas.ver'],
      }),
    };

    const catalogServiceMock = {
      branches: vi.fn(() => of(mockBranches)),
    };

    const commerceServiceMock = {
      adminDashboardSummary: vi.fn(() => summaryResponse),
    };

    TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
        { provide: CatalogService, useValue: catalogServiceMock },
        { provide: CommerceService, useValue: commerceServiceMock },
      ],
    });

    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, commerceServiceMock, catalogServiceMock };
  }

  it('renders executive KPI cards with correct data', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Centro de Comando');
    expect(el.textContent).toContain('Ventas del Mes');
    expect(el.textContent).toContain('+14.8%');
    expect(el.textContent).toContain('12'); // Pedidos pendientes
    expect(el.textContent).toContain('8'); // Reservas hoy
    expect(el.textContent).toContain('5'); // Stock crítico
  });

  it('renders native SVG weekly chart and branch donut', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;

    const svgElements = el.querySelectorAll('svg');
    expect(svgElements.length).toBeGreaterThanOrEqual(2);

    // X-axis day names rendered in chart
    expect(el.textContent).toContain('Lun');
    expect(el.textContent).toContain('Sáb');

    // Branch donut legend items
    expect(el.textContent).toContain('Sucursal Central');
    expect(el.textContent).toContain('66.7%');
    expect(el.textContent).toContain('Sucursal Banzer');
    expect(el.textContent).toContain('33.3%');
  });

  it('renders urgent orders table and top products list', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Carla Mendoza');
    expect(el.textContent).toContain('#101');
    expect(el.textContent).toContain('Preparando');
    expect(el.textContent).toContain('Vestido Seda Floral');
    expect(el.textContent).toContain('34 u.');
  });

  it('filters data reactively when branch is changed', () => {
    const { fixture, component, commerceServiceMock } = setup();

    expect(commerceServiceMock.adminDashboardSummary).toHaveBeenCalledWith(null);

    component.onBranchChange(2);
    fixture.detectChanges();

    expect(commerceServiceMock.adminDashboardSummary).toHaveBeenCalledWith(2);
    expect(component.selectedBranchId()).toBe(2);
  });

  it('displays error notice if summary call fails', () => {
    const { fixture } = setup(
      throwError(() => ({ error: { detail: 'Error de conexión con el servidor' } })),
    );
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Error de conexión con el servidor');
  });
});
