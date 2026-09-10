import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { Product, ProductMeasurement } from '../../core/models/catalog.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CommerceService } from '../../core/services/commerce.service';
import { ProductDetail } from './product-detail';

const product = (stock: number): Product => ({
  id_producto: 1,
  id_categoria: 1,
  categoria: 'POLO',
  id_marca: 1,
  marca: 'Ralph Lauren',
  nombre: 'Polo Classic Fit',
  descripcion: 'Polo de prueba',
  publico_objetivo: 'HOMBRE',
  permite_vestidor: false,
  activo: true,
  precio_actual: '200.00',
  imagen_principal: null,
  variantes: [
    {
      id_variante: 11,
      id_producto: 1,
      id_talla: 1,
      talla: 'S',
      id_color: 1,
      color: 'Azul marino',
      codigo_hex: '#14213d',
      sku: 'POLO-AZM-S',
      codigo_barras: null,
      activo: true,
      stock_disponible: stock,
      estado_stock: stock > 0 ? 'DISPONIBLE' : 'AGOTADO',
    },
  ],
  tallas_disponibles: ['S'],
  colores_disponibles: ['Azul marino'],
  created_at: '2026-09-10T00:00:00Z',
  updated_at: '2026-09-10T00:00:00Z',
});

const measurements: ProductMeasurement[] = [
  {
    id_medida: 1,
    id_producto: 1,
    id_talla: 1,
    talla: 'S',
    ancho_hombros_cm: '44.00',
    ancho_pecho_cm: '52.00',
    largo_prenda_cm: '73.00',
    largo_manga_cm: '23.00',
  },
  {
    id_medida: 2,
    id_producto: 1,
    id_talla: 2,
    talla: 'M',
    ancho_hombros_cm: '46.00',
    ancho_pecho_cm: '56.00',
    largo_prenda_cm: '75.00',
    largo_manga_cm: '24.00',
  },
];

describe('ProductDetail', () => {
  it('keeps the selected branch visible and explains when it has no stock', () => {
    const commerce = { addCartItem: vi.fn(() => of({})) };
    const catalog = {
      branches: vi.fn(() =>
        of([
          { id_sucursal: 1, nombre: 'Capricho Store Central', direccion: 'Centro' },
          { id_sucursal: 2, nombre: 'Capricho Store Banzer', direccion: 'Banzer' },
        ]),
      ),
      product: vi.fn((_id: number, branchId?: number) =>
        of(branchId === 2 ? product(0) : product(5)),
      ),
      images: vi.fn(() => of([])),
      measurements: vi.fn(() => of([])),
    };
    TestBed.configureTestingModule({
      imports: [ProductDetail],
      providers: [
        provideRouter([]),
        { provide: CatalogService, useValue: catalog },
        { provide: CommerceService, useValue: commerce },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({
              id_usuario: 1,
              nombres: 'Ana',
              apellidos: 'Pérez',
              roles: ['CLIENTE'],
              permisos: [],
            }),
          },
        },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '1' } } },
        },
      ],
    });

    const fixture = TestBed.createComponent(ProductDetail);
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('#detail-branch') as HTMLSelectElement;
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedBranchId()).toBe(2);
    expect(select.value).toBe('2');
    expect(fixture.nativeElement.textContent).toContain(
      'Sin stock de Azul marino, talla S, en Capricho Store Banzer.',
    );
    expect(
      (fixture.nativeElement.querySelector('.product-purchase button') as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    select.value = '1';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const quantity = fixture.nativeElement.querySelector('#detail-quantity') as HTMLInputElement;
    quantity.value = '3';
    quantity.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.product-purchase button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(quantity.max).toBe('5');
    expect(fixture.componentInstance.quantity()).toBe(3);
    expect(commerce.addCartItem).toHaveBeenCalledWith(11, 3);
    expect(fixture.nativeElement.textContent).toContain('Se agregaron 3 unidades al carrito.');
  });

  it('shows only the measurements for the selected size', () => {
    const catalogProduct = product(5);
    catalogProduct.variantes.push({
      ...catalogProduct.variantes[0],
      id_variante: 12,
      id_talla: 2,
      talla: 'M',
      sku: 'POLO-AZM-M',
    });
    catalogProduct.tallas_disponibles = ['S', 'M'];
    const catalog = {
      branches: vi.fn(() => of([])),
      product: vi.fn(() => of(catalogProduct)),
      images: vi.fn(() => of([])),
      measurements: vi.fn(() => of(measurements)),
    };
    TestBed.configureTestingModule({
      imports: [ProductDetail],
      providers: [
        provideRouter([]),
        { provide: CatalogService, useValue: catalog },
        { provide: CommerceService, useValue: { addCartItem: vi.fn(() => of({})) } },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '1' } } },
        },
      ],
    });

    const fixture = TestBed.createComponent(ProductDetail);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Medidas de la talla S');
    expect(fixture.nativeElement.textContent).toContain('44 cm');
    expect(fixture.nativeElement.textContent).not.toContain('46 cm');
    expect(fixture.nativeElement.querySelector('.measurements')).toBeNull();

    fixture.componentInstance.selectSize('M');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Medidas de la talla M');
    expect(fixture.nativeElement.textContent).toContain('46 cm');
    expect(fixture.nativeElement.textContent).not.toContain('44 cm');
  });
});
