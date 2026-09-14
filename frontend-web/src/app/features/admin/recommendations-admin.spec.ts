import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { RecommendationConfig, RecommendationStats } from '../../core/models/recommendation.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CommerceService } from '../../core/services/commerce.service';
import { RecommendationService } from '../../core/services/recommendation.service';
import { RecommendationsAdmin } from './recommendations-admin';

const SAMPLE_CONFIG: RecommendationConfig = {
  id_configuracion: 1,
  peso_categoria: 25,
  peso_marca: 20,
  peso_color: 15,
  peso_talla: 15,
  peso_temporada: 15,
  peso_promocion: 10,
  activo: true,
  created_at: '2026-09-14T12:00:00Z',
  suma_pesos: 100,
};

const SAMPLE_STATS: RecommendationStats = {
  total_interacciones: 150,
  clientes_con_interacciones: 45,
  interacciones_por_tipo: {
    VER_PRODUCTO: 90,
    AGREGAR_CARRITO: 35,
    USAR_VESTIDOR: 15,
    COMPRAR: 10,
  },
  pesos_activos: {
    peso_categoria: 25,
    peso_marca: 20,
    peso_color: 15,
    peso_talla: 15,
    peso_temporada: 15,
    peso_promocion: 10,
  },
};

describe('RecommendationsAdmin', () => {
  it('renders recommendation config, stats KPIs, and validates weights', () => {
    const recMock = {
      getConfig: vi.fn(() => of(SAMPLE_CONFIG)),
      getStats: vi.fn(() => of(SAMPLE_STATS)),
      updateConfig: vi.fn(),
      simulateForClient: vi.fn(() => of({ cliente_id: 1, total: 0, items: [] })),
    };
    const commerceMock = {
      adminCustomers: vi.fn(() => of([{ id_cliente: 1, nombres: 'Ana', apellidos: 'Gomez', correo: 'ana@test.com', total_pedidos: 2 }])),
    };

    TestBed.configureTestingModule({
      imports: [RecommendationsAdmin],
      providers: [
        { provide: RecommendationService, useValue: recMock },
        { provide: CommerceService, useValue: commerceMock },
        { provide: ApiErrorService, useValue: { message: vi.fn(() => 'Error') } },
      ],
    });

    const fixture = TestBed.createComponent(RecommendationsAdmin);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Motor Recomendador Híbrido');
    expect(el.textContent).toContain('Ponderación de Factores');

    // Weight sum computation
    expect(fixture.componentInstance.totalWeight()).toBe(100);
    expect(fixture.componentInstance.isSumValid()).toBe(true);

    // KPI stats
    expect(el.textContent).toContain('150');
    expect(el.textContent).toContain('45');
  });

  it('detects invalid weight sums when weights deviate from 100%', () => {
    const recMock = {
      getConfig: vi.fn(() => of({ ...SAMPLE_CONFIG, peso_categoria: 30 })),
      getStats: vi.fn(() => of(SAMPLE_STATS)),
    };
    const commerceMock = {
      adminCustomers: vi.fn(() => of([])),
    };

    TestBed.configureTestingModule({
      imports: [RecommendationsAdmin],
      providers: [
        { provide: RecommendationService, useValue: recMock },
        { provide: CommerceService, useValue: commerceMock },
        { provide: ApiErrorService, useValue: { message: vi.fn(() => 'Error') } },
      ],
    });

    const fixture = TestBed.createComponent(RecommendationsAdmin);
    fixture.detectChanges();

    expect(fixture.componentInstance.totalWeight()).toBe(105);
    expect(fixture.componentInstance.isSumValid()).toBe(false);
  });
});
