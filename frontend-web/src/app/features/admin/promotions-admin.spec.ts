import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Promotion } from '../../core/models/commerce.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CommerceService } from '../../core/services/commerce.service';
import { PromotionsAdmin } from './promotions-admin';

const SAMPLE_PROMOTIONS: Promotion[] = [
  {
    id_promocion: 1,
    nombre: 'Descuento Primavera',
    descripcion: '20% off en prendas seleccionadas',
    porcentaje_descuento: 20,
    fecha_inicio: '2026-09-14T10:00:00Z',
    fecha_fin: '2026-09-24T10:00:00Z',
    activo: true,
    created_at: '2026-09-14T09:00:00Z',
    updated_at: '2026-09-14T09:00:00Z',
    producto_ids: [1, 2],
    categoria_ids: [],
    temporada_ids: [],
    productos_count: 2,
    categorias_count: 0,
    temporadas_count: 0,
    estado_vigencia: 'VIGENTE',
  },
  {
    id_promocion: 2,
    nombre: 'Cyber Week',
    descripcion: '30% en toda la tienda',
    porcentaje_descuento: 30,
    fecha_inicio: '2026-10-01T00:00:00Z',
    fecha_fin: '2026-10-07T23:59:59Z',
    activo: true,
    created_at: '2026-09-14T09:00:00Z',
    updated_at: '2026-09-14T09:00:00Z',
    producto_ids: [],
    categoria_ids: [],
    temporada_ids: [],
    productos_count: 0,
    categorias_count: 0,
    temporadas_count: 0,
    estado_vigencia: 'PROGRAMADA',
  },
];

describe('PromotionsAdmin', () => {
  it('renders promotions table and computes KPIs accurately', () => {
    const commerceMock = {
      adminPromotions: vi.fn(() => of(SAMPLE_PROMOTIONS)),
      createPromotion: vi.fn(),
      updatePromotion: vi.fn(),
      deletePromotion: vi.fn(),
    };
    const catalogMock = {
      options: vi.fn(() => of({ categories: [], seasons: [] })),
      products: vi.fn(() => of({ items: [] })),
    };

    TestBed.configureTestingModule({
      imports: [PromotionsAdmin],
      providers: [
        { provide: CommerceService, useValue: commerceMock },
        { provide: CatalogService, useValue: catalogMock },
        { provide: ApiErrorService, useValue: { message: vi.fn(() => 'Error') } },
      ],
    });

    const fixture = TestBed.createComponent(PromotionsAdmin);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Gestión de Promociones');

    // KPIs
    expect(fixture.componentInstance.kpis().total).toBe(2);
    expect(fixture.componentInstance.kpis().vigentes).toBe(1);
    expect(fixture.componentInstance.kpis().programadas).toBe(1);
    expect(fixture.componentInstance.kpis().promedioDescuento).toBe(20);

    // Table rows
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Descuento Primavera');
    expect(rows[0].textContent).toContain('-20%');
    expect(rows[1].textContent).toContain('Cyber Week');
    expect(rows[1].textContent).toContain('-30%');
  });

  it('filters promotions by search query', () => {
    const commerceMock = {
      adminPromotions: vi.fn(() => of(SAMPLE_PROMOTIONS)),
    };
    const catalogMock = {
      options: vi.fn(() => of({ categories: [], seasons: [] })),
      products: vi.fn(() => of({ items: [] })),
    };

    TestBed.configureTestingModule({
      imports: [PromotionsAdmin],
      providers: [
        { provide: CommerceService, useValue: commerceMock },
        { provide: CatalogService, useValue: catalogMock },
        { provide: ApiErrorService, useValue: { message: vi.fn(() => 'Error') } },
      ],
    });

    const fixture = TestBed.createComponent(PromotionsAdmin);
    fixture.detectChanges();

    fixture.componentInstance.searchQuery.set('Cyber');
    fixture.detectChanges();

    expect(fixture.componentInstance.filteredPromotions().length).toBe(1);
    expect(fixture.componentInstance.filteredPromotions()[0].nombre).toBe('Cyber Week');
  });
});
