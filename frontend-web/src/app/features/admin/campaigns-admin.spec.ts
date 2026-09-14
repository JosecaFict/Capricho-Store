import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Campaign } from '../../core/models/commerce.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CommerceService } from '../../core/services/commerce.service';
import { CampaignsAdmin } from './campaigns-admin';

const SAMPLE_CAMPAIGNS: Campaign[] = [
  {
    id_campania: 1,
    nombre: 'Liquidación Primavera',
    descripcion: '20% off en poleras y camisas',
    asunto_email: 'Descuentos exclusivos',
    segmento_objetivo: 'TODOS',
    fecha_inicio: '2026-09-14T10:00:00Z',
    fecha_fin: null,
    estado: 'BORRADOR',
    created_at: '2026-09-14T09:00:00Z',
    updated_at: '2026-09-14T09:00:00Z',
    total_notificaciones: 0,
  },
  {
    id_campania: 2,
    nombre: 'Campaña Lanzamiento',
    descripcion: 'Nueva temporada disponible',
    asunto_email: 'Lanzamiento oficial',
    segmento_objetivo: 'CON_COMPRAS',
    fecha_inicio: '2026-09-10T10:00:00Z',
    fecha_fin: null,
    estado: 'FINALIZADA',
    created_at: '2026-09-10T09:00:00Z',
    updated_at: '2026-09-10T09:00:00Z',
    total_notificaciones: 45,
  },
];

describe('CampaignsAdmin', () => {
  it('renders campaigns table and calculates KPIs accurately', () => {
    const commerceMock = {
      adminCampaigns: vi.fn(() => of(SAMPLE_CAMPAIGNS)),
      createCampaign: vi.fn(),
      launchCampaign: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [CampaignsAdmin],
      providers: [
        { provide: CommerceService, useValue: commerceMock },
        { provide: ApiErrorService, useValue: { message: vi.fn(() => 'Error') } },
      ],
    });

    const fixture = TestBed.createComponent(CampaignsAdmin);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Campañas y Difusión Masiva');

    // KPIs
    expect(el.textContent).toContain('Total Campañas');
    expect(fixture.componentInstance.kpis().total).toBe(2);
    expect(fixture.componentInstance.kpis().finalizadas).toBe(1);
    expect(fixture.componentInstance.kpis().borradores).toBe(1);
    expect(fixture.componentInstance.kpis().impactoTotal).toBe(45);

    // Table rows
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Liquidación Primavera');
    expect(rows[1].textContent).toContain('Campaña Lanzamiento');
  });

  it('filters campaigns by search query', () => {
    const commerceMock = {
      adminCampaigns: vi.fn(() => of(SAMPLE_CAMPAIGNS)),
    };

    TestBed.configureTestingModule({
      imports: [CampaignsAdmin],
      providers: [
        { provide: CommerceService, useValue: commerceMock },
        { provide: ApiErrorService, useValue: { message: vi.fn(() => 'Error') } },
      ],
    });

    const fixture = TestBed.createComponent(CampaignsAdmin);
    fixture.detectChanges();

    fixture.componentInstance.searchQuery.set('Primavera');
    fixture.detectChanges();

    expect(fixture.componentInstance.filteredCampaigns().length).toBe(1);
    expect(fixture.componentInstance.filteredCampaigns()[0].nombre).toBe('Liquidación Primavera');
  });
});
