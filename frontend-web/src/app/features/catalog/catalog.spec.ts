import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CatalogOptions, ProductPage } from '../../core/models/catalog.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogService } from '../../core/services/catalog.service';
import { Catalog } from './catalog';

const mockOptions: CatalogOptions = {
  categories: [
    {
      id_categoria: 1,
      nombre: 'POLO',
      descripcion: null,
      activo: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
    {
      id_categoria: 2,
      nombre: 'BLUSA',
      descripcion: null,
      activo: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
  ],
  brands: [
    {
      id_marca: 1,
      nombre: 'Zara',
      descripcion: null,
      pais_origen: 'España',
      activo: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
    {
      id_marca: 2,
      nombre: 'Nike',
      descripcion: null,
      pais_origen: 'EEUU',
      activo: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
  ],
  sizes: [
    { id_talla: 1, codigo: 'S', orden: 1, activo: true },
    { id_talla: 2, codigo: 'M', orden: 2, activo: true },
  ],
  colors: [
    { id_color: 1, nombre: 'Azul', codigo_hex: '#0000ff', activo: true },
    { id_color: 2, nombre: 'Rojo', codigo_hex: '#ff0000', activo: true },
  ],
  seasons: [
    {
      id_temporada: 1,
      nombre: 'Verano',
      anio: 2026,
      fecha_inicio: null,
      fecha_fin: null,
      activo: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
  ],
  branches: [
    { id_sucursal: 1, nombre: 'Sucursal Central', direccion: 'Av. Principal 123' },
    { id_sucursal: 2, nombre: 'Sucursal Banzer', direccion: '4to Anillo' },
  ],
};

const mockPage: ProductPage = {
  items: [
    {
      id_producto: 1,
      id_categoria: 1,
      categoria: 'POLO',
      id_marca: 1,
      marca: 'Zara',
      nombre: 'Polo Slim',
      descripcion: 'Polo de algodón',
      publico_objetivo: 'HOMBRE',
      permite_vestidor: true,
      activo: true,
      precio_actual: '120.00',
      imagen_principal: null,
      variantes: [],
      tallas_disponibles: ['S'],
      colores_disponibles: ['Azul'],
      created_at: '2026-09-10T00:00:00Z',
      updated_at: '2026-09-10T00:00:00Z',
    },
  ],
  page: 1,
  page_size: 12,
  total: 1,
  pages: 1,
};

describe('Catalog Component', () => {
  function setupTest(queryParams: Record<string, string> = {}) {
    const catalogService = {
      options: vi.fn(() => of(mockOptions)),
      products: vi.fn(() => of(mockPage)),
    };

    TestBed.configureTestingModule({
      imports: [Catalog],
      providers: [
        provideRouter([]),
        { provide: CatalogService, useValue: catalogService },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(queryParams),
            },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(Catalog);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true as never);
    fixture.detectChanges();

    return { fixture, component: fixture.componentInstance, catalogService, router };
  }

  it('renders branch selector in header and loads branches', () => {
    const { fixture, catalogService } = setupTest();
    const branchSelect = fixture.nativeElement.querySelector('#branch-filter') as HTMLSelectElement;

    expect(branchSelect).not.toBeNull();
    // 1 default option ('Todas las sucursales') + 2 mock branches
    expect(branchSelect.options.length).toBe(3);
    expect(branchSelect.options[1].textContent?.trim()).toBe('Sucursal Central');
    expect(branchSelect.options[2].textContent?.trim()).toBe('Sucursal Banzer');

    // Changing branch triggers product reload with sucursal filter immediately
    branchSelect.value = '2';
    branchSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(catalogService.products).toHaveBeenCalledWith(
      expect.objectContaining({
        sucursal: 2,
        page: 1,
      }),
    );
  });

  it('renders 6 primary filters in the exact order: Público, Categoría, Marca, Talla, Color, Temporada', () => {
    const { fixture } = setupTest();
    const filterRow = fixture.nativeElement.querySelector('.primary-filter-row');
    expect(filterRow).not.toBeNull();

    const labels = Array.from(filterRow.querySelectorAll('label')).map((el: any) =>
      el.textContent?.trim(),
    );
    expect(labels).toEqual([
      'Público',
      'Categoría',
      'Marca',
      'Talla',
      'Color',
      'Temporada',
    ]);
  });

  it('filters reactively on any filter change without needing an "Aplicar" button', () => {
    const { fixture, catalogService } = setupTest();

    // Verify there is no "Aplicar" button in the template
    const applyButton = fixture.nativeElement.querySelector('.button--primary[type="submit"]');
    expect(applyButton).toBeNull();

    // Change Brand reactively
    const brandSelect = fixture.nativeElement.querySelector('#brand-filter') as HTMLSelectElement;
    brandSelect.value = 'Zara';
    brandSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(catalogService.products).toHaveBeenCalledWith(
      expect.objectContaining({
        marca: 'Zara',
        page: 1,
      }),
    );
  });

  it('normalizes gender when BLUSA is selected with HOMBRE', () => {
    const { fixture, component } = setupTest();
    component.form.patchValue({
      publico_objetivo: 'HOMBRE',
      categoria: 'BLUSA',
    });

    component.onCategoryChange();
    fixture.detectChanges();

    expect(component.form.controls.publico_objetivo.value).toBe('MUJER');
  });

  it('renders vestidor filter and product count in secondary bar', () => {
    const { fixture } = setupTest();
    const fittingFilter = fixture.nativeElement.querySelector('#fitting-filter');
    expect(fittingFilter).not.toBeNull();

    const count = fixture.nativeElement.querySelector('.catalog-count');
    expect(count?.textContent?.trim()).toBe('1 producto');
  });

  it('shows clear filters button when active filters exist and clears them on click', () => {
    const { fixture, component, catalogService } = setupTest();

    // Initially no active filter button
    let clearBtn = fixture.nativeElement.querySelector('.button--clear-filters');
    expect(clearBtn).toBeNull();

    // Set a filter
    const sizeSelect = fixture.nativeElement.querySelector('#size-filter') as HTMLSelectElement;
    sizeSelect.value = 'S';
    sizeSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    // Clear filters button should now be visible
    clearBtn = fixture.nativeElement.querySelector('.button--clear-filters');
    expect(clearBtn).not.toBeNull();
    expect(clearBtn.textContent).toContain('Limpiar filtros (1)');

    // Click clear filters button
    clearBtn.click();
    fixture.detectChanges();

    expect(component.form.controls.talla.value).toBe('');
    expect(catalogService.products).toHaveBeenLastCalledWith(
      expect.objectContaining({
        talla: undefined,
        page: 1,
      }),
    );
  });
});
