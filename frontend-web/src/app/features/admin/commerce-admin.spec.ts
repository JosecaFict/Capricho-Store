import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { Branch, Product } from '../../core/models/catalog.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CommerceService } from '../../core/services/commerce.service';
import { PosSalesAdmin } from './commerce-admin';

const mockBranches: Branch[] = [
  { id_sucursal: 1, nombre: 'Sucursal Central', direccion: 'Av. Principal 100' },
  { id_sucursal: 2, nombre: 'Sucursal Equipetrol', direccion: 'Calle 5 Este 200' },
];

const mockProducts: Product[] = [
  {
    id_producto: 10,
    id_categoria: 1,
    categoria: 'Poleras',
    id_marca: 1,
    marca: 'Capricho Urban',
    nombre: 'Polera Oversize Basic',
    descripcion: 'Algodón 100%',
    publico_objetivo: 'HOMBRE',
    permite_vestidor: true,
    activo: true,
    precio_actual: '120.00',
    imagen_principal: null,
    variantes: [
      {
        id_variante: 101,
        id_producto: 10,
        id_talla: 2,
        talla: 'M',
        id_color: 3,
        color: 'Negro',
        codigo_hex: '#000000',
        sku: 'POL-OVR-NEG-M',
        codigo_barras: '7771234567890',
        activo: true,
        stock_disponible: 5,
      },
      {
        id_variante: 102,
        id_producto: 10,
        id_talla: 2,
        talla: 'M',
        id_color: 4,
        color: 'Blanco',
        codigo_hex: '#FFFFFF',
        sku: 'POL-OVR-BLA-M',
        codigo_barras: '7771234567891',
        activo: true,
        stock_disponible: 2,
      },
      {
        id_variante: 103,
        id_producto: 10,
        id_talla: 3,
        talla: 'L',
        id_color: 3,
        color: 'Negro',
        codigo_hex: '#000000',
        sku: 'POL-OVR-NEG-L',
        codigo_barras: '7771234567892',
        activo: true,
        stock_disponible: 0,
      },
    ],
    tallas_disponibles: ['M', 'L'],
    colores_disponibles: ['Negro', 'Blanco'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id_producto: 20,
    id_categoria: 2,
    categoria: 'Jeans',
    id_marca: 2,
    marca: 'Denim Co',
    nombre: 'Jean Baggy Classic',
    descripcion: 'Mezclilla rígida',
    publico_objetivo: 'HOMBRE',
    permite_vestidor: true,
    activo: true,
    precio_actual: '250.00',
    imagen_principal: null,
    variantes: [
      {
        id_variante: 201,
        id_producto: 20,
        id_talla: 4,
        talla: '32',
        id_color: 5,
        color: 'Azul',
        codigo_hex: '#1E3A8A',
        sku: 'JEA-BAG-AZU-32',
        codigo_barras: '7779876543210',
        activo: true,
        stock_disponible: 3,
      },
    ],
    tallas_disponibles: ['32'],
    colores_disponibles: ['Azul'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

describe('PosSalesAdmin', () => {
  it('locks branch for assigned cashiers and cascades garment selection (Brand -> Model -> Size -> Color -> Add to ticket)', () => {
    const userSignal = signal({
      id_usuario: 5,
      nombres: 'Carlos',
      apellidos: 'Cajero',
      correo: 'carlos@capricho.bo',
      telefono: null,
      ci: null,
      estado: 'ACTIVO' as const,
      created_at: '2026-01-01',
      roles: ['CAJERO'],
      permisos: ['ventas.crear'],
      id_sucursal: 2,
      sucursal: 'Sucursal Equipetrol',
    });

    const catalog = {
      branches: vi.fn(() => of(mockBranches)),
      products: vi.fn(() => of({ items: mockProducts, page: 1, page_size: 100, total: 2, pages: 1 })),
    };

    const commerce = {
      createPosSale: vi.fn(() =>
        of({
          id_venta: 88,
          id_cliente: null,
          id_sucursal: 2,
          sucursal: 'Sucursal Equipetrol',
          id_empleado: 5,
          id_reserva: null,
          canal_venta: 'PRESENCIAL',
          modalidad_entrega: 'ENTREGA_DIRECTA',
          estado: 'COMPLETADA',
          subtotal: '240.00',
          costo_envio: '0.00',
          total: '240.00',
          fecha_venta: '2026-09-13 10:00',
          items: [],
        }),
      ),
    };

    TestBed.configureTestingModule({
      imports: [PosSalesAdmin],
      providers: [
        { provide: AuthService, useValue: { currentUser: userSignal.asReadonly() } },
        { provide: CatalogService, useValue: catalog },
        { provide: CommerceService, useValue: commerce },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });

    const fixture = TestBed.createComponent(PosSalesAdmin);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;

    // 1. Branch verification for Cashier
    expect(component.canSelectBranch()).toBe(false);
    expect(component.assignedBranchName()).toBe('Sucursal Equipetrol');
    expect(component.selectedBranchId()).toBe(2);
    expect(element.textContent).toContain('Sucursal asignada a tu usuario');
    expect(element.textContent).toContain('Caja Asignada (Fija)');
    expect(element.querySelector('.pos-branch-admin-banner select')).toBeNull();

    // 2. Cascading Garment Selection
    // Check computed brands
    expect(component.brands()).toEqual([
      { id: 1, nombre: 'Capricho Urban' },
      { id: 2, nombre: 'Denim Co' },
    ]);

    // Step 1: Select brand 'Capricho Urban' (id: 1)
    component.onBrandChange('1');
    expect(component.selectedBrandId()).toBe(1);
    expect(component.productsForBrand().length).toBe(1);
    expect(component.productsForBrand()[0].nombre).toBe('Polera Oversize Basic');

    // Step 2: Select product (id: 10)
    component.onProductChange('10');
    expect(component.selectedProductId()).toBe(10);
    // Since only 'M' and 'L' are available:
    expect(component.availableSizes()).toEqual(['M', 'L']);

    // Step 3: Select size 'M'
    component.onSizeChange('M');
    expect(component.selectedSize()).toBe('M');
    expect(component.availableVariantsForSize().length).toBe(2); // Negro and Blanco

    // Step 4: Select variant / color (id: 101, Negro, stock: 5)
    component.onVariantChange('101');
    expect(component.selectedVariantId()).toBe(101);
    expect(component.selectedStock()).toBe(5);
    expect(component.canAddCurrentVariant()).toBe(true);

    // Step 5: Set quantity to 2
    component.quantity.set(2);
    expect(component.currentItemSubtotal()).toBe(240);

    // Add to ticket
    component.addLine();
    expect(component.lines().length).toBe(1);
    expect(component.lines()[0].variant.id_variante).toBe(101);
    expect(component.lines()[0].quantity).toBe(2);
    expect(component.estimatedTotal()).toBe(240);

    // 3. Confirm POS Cash Sale
    component.confirm();
    expect(commerce.createPosSale).toHaveBeenCalledWith({
      id_sucursal: 2,
      modalidad_entrega: 'ENTREGA_DIRECTA',
      registrar_efectivo: true,
      items: [{ id_variante: 101, cantidad: 2 }],
    });
    expect(component.completed()?.id_venta).toBe(88);
    expect(component.lines().length).toBe(0);
  });

  it('allows administrators to select branch and quickly scan barcodes/SKUs', () => {
    const adminSignal = signal({
      id_usuario: 1,
      nombres: 'Admin',
      apellidos: 'General',
      correo: 'admin@capricho.bo',
      telefono: null,
      ci: null,
      estado: 'ACTIVO' as const,
      created_at: '2026-01-01',
      roles: ['ADMIN'],
      permisos: ['ventas.crear', 'ventas.sucursales_todas'],
      id_sucursal: null,
      sucursal: null,
    });

    const catalog = {
      branches: vi.fn(() => of(mockBranches)),
      products: vi.fn(() => of({ items: mockProducts, page: 1, page_size: 100, total: 2, pages: 1 })),
    };

    TestBed.configureTestingModule({
      imports: [PosSalesAdmin],
      providers: [
        { provide: AuthService, useValue: { currentUser: adminSignal.asReadonly() } },
        { provide: CatalogService, useValue: catalog },
        { provide: CommerceService, useValue: { createPosSale: vi.fn() } },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });

    const fixture = TestBed.createComponent(PosSalesAdmin);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;

    // 1. Admin can select branch
    expect(component.canSelectBranch()).toBe(true);
    expect(element.querySelector('.pos-branch-admin-banner select')).not.toBeNull();

    // 2. Barcode scanner quick match: 'POL-OVR-NEG-M'
    component.onBarcodeScan('POL-OVR-NEG-M');
    expect(component.selectedBrandId()).toBe(1);
    expect(component.selectedProductId()).toBe(10);
    expect(component.selectedSize()).toBe('M');
    expect(component.selectedVariantId()).toBe(101);
    expect(component.barcodeMatchNotice()).toContain('Polera Oversize Basic');

    // 3. Barcode digits scan: '7779876543210'
    component.onBarcodeScan('7779876543210');
    expect(component.selectedBrandId()).toBe(2);
    expect(component.selectedProductId()).toBe(20);
    expect(component.selectedSize()).toBe('32');
    expect(component.selectedVariantId()).toBe(201);
  });
});
