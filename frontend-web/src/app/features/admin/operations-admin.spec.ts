import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../../core/permissions/permission.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AdminApiService } from './admin-api.service';
import { PurchasesAdmin, ReceiptsAdmin } from './operations-admin';

describe('PurchasesAdmin', () => {
  it('groups variants into a color and size matrix and expands quantities on save', () => {
    const variants = [
      {
        id_variante: 11,
        id_producto: 1,
        producto: 'Polo Classic Fit',
        sku: 'POLO-AZM-S',
        color: 'Azul marino',
        talla: 'S',
      },
      {
        id_variante: 12,
        id_producto: 1,
        producto: 'Polo Classic Fit',
        sku: 'POLO-AZM-M',
        color: 'Azul marino',
        talla: 'M',
      },
      {
        id_variante: 13,
        id_producto: 1,
        producto: 'Polo Classic Fit',
        sku: 'POLO-BLA-S',
        color: 'Blanco',
        talla: 'S',
      },
    ];
    const api = {
      list: vi.fn((path: string) => {
        if (path === 'suppliers') return of([{ id_proveedor: 5, razon_social: 'Distribuidora' }]);
        if (path === 'branches') return of([{ id_sucursal: 2, nombre: 'Central' }]);
        if (path === 'variants') return of(variants);
        if (path === 'suppliers/5/products') return of([{ id_producto: 1, activo: true }]);
        return of([]);
      }),
      products: vi.fn(() =>
        of({
          items: [{ id_producto: 1, nombre: 'Polo Classic Fit', marca: 'Ralph Lauren' }],
          page: 1,
          page_size: 100,
          total: 1,
          pages: 1,
        }),
      ),
      post: vi.fn(() => of({})),
      patch: vi.fn(() => of({})),
    };
    TestBed.configureTestingModule({
      imports: [PurchasesAdmin],
      providers: [
        { provide: AdminApiService, useValue: api },
        { provide: PermissionService, useValue: { has: () => true } },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });

    const fixture = TestBed.createComponent(PurchasesAdmin);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.show.set(true);
    component.form.patchValue({ id_proveedor: 5, id_sucursal: 2 });
    component.selectSupplier();
    component.details.at(0).patchValue({ marca: 'Ralph Lauren', id_producto: 1 });
    component.prepareProductMatrix(0);
    (component.details.at(0).get('cantidades') as FormGroup).patchValue({ 11: 3, 13: 2 });
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Cantidades por color y talla');
    expect(element.querySelectorAll('.purchase-matrix tbody tr')).toHaveLength(2);
    expect(component.rowVariantCount(0)).toBe(2);
    expect(component.rowUnitCount(0)).toBe(5);

    component.save();

    expect(api.post).toHaveBeenCalledWith(
      'purchase-orders',
      expect.objectContaining({
        id_proveedor: 5,
        id_sucursal: 2,
        detalles: [
          { id_variante: 11, cantidad: 3, costo_unitario_estimado: null },
          { id_variante: 13, cantidad: 2, costo_unitario_estimado: null },
        ],
      }),
    );
  });
});

describe('ReceiptsAdmin', () => {
  it('loads the ordered balance and sends only quantities received now', () => {
    const order = {
      id_orden_compra: 8,
      id_sucursal: 2,
      estado: 'EN_TRANSITO',
      detalles: [
        {
          id_detalle_orden_compra: 80,
          id_variante: 11,
          cantidad: 5,
          cantidad_recibida: 2,
          cantidad_pendiente: 3,
          costo_unitario_estimado: 150,
        },
        {
          id_detalle_orden_compra: 81,
          id_variante: 12,
          cantidad: 4,
          cantidad_recibida: 0,
          cantidad_pendiente: 4,
          costo_unitario_estimado: 160,
        },
      ],
    };
    const api = {
      list: vi.fn((path: string) => {
        if (path === 'purchase-orders') return of([order]);
        if (path === 'branches') return of([{ id_sucursal: 2, nombre: 'Central' }]);
        if (path === 'variants')
          return of([
            {
              id_variante: 11,
              producto: 'Polo Classic Fit',
              sku: 'POLO-AZM-S',
              color: 'Azul marino',
              talla: 'S',
            },
            {
              id_variante: 12,
              producto: 'Polo Classic Fit',
              sku: 'POLO-AZM-M',
              color: 'Azul marino',
              talla: 'M',
            },
          ]);
        return of([]);
      }),
      post: vi.fn(() => of({})),
    };
    TestBed.configureTestingModule({
      imports: [ReceiptsAdmin],
      providers: [
        { provide: AdminApiService, useValue: api },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });

    const fixture = TestBed.createComponent(ReceiptsAdmin);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.show.set(true);
    component.form.patchValue({ id_orden_compra: 8, observacion: 'Una unidad con demora' });
    component.selectOrder();
    fixture.detectChanges();

    expect(component.details.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Control de cantidades');
    expect(fixture.nativeElement.textContent).toContain('Recibido antes');
    expect(fixture.nativeElement.textContent).toContain('Pendiente');
    expect(component.details.at(0).value).toMatchObject({
      cantidad_solicitada: 5,
      cantidad_recibida_anterior: 2,
      cantidad_pendiente: 3,
      cantidad_recibida: 3,
    });
    expect(component.pendingTotal()).toBe(7);
    expect(component.completesOrder()).toBe(true);

    component.details.at(0).patchValue({ cantidad_recibida: 1, numero_lote: 'L-001' });
    component.details.at(1).patchValue({ cantidad_recibida: 0 });
    expect(component.completesOrder()).toBe(false);
    component.save();

    expect(api.post).toHaveBeenCalledWith('receipts', {
      id_orden_compra: 8,
      observacion: 'Una unidad con demora',
      detalles: [
        {
          id_variante: 11,
          cantidad_recibida: 1,
          costo_unitario: 150,
          numero_lote: 'L-001',
        },
      ],
    });
  });
});
