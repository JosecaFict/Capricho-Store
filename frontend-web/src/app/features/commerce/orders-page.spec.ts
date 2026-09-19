import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Order } from '../../core/models/commerce.model';
import { CommerceService } from '../../core/services/commerce.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { OrdersPage } from './commerce-pages';

const MOCK_ORDERS: Order[] = [
  {
    id_pedido: 101,
    id_venta: 501,
    id_cliente: 42,
    cliente_nombre: 'Flabia Dominguez',
    cliente_correo: 'flabia@gmail.com',
    estado: 'EN_CAMINO',
    modalidad_entrega: 'DELIVERY',
    id_sucursal: 1,
    sucursal: 'Capricho Store Central',
    direccion_sucursal: '2do Anillo La Pirai',
    id_direccion: 5,
    direccion_entrega: 'Av. San Martín #450',
    total: '240.00',
    fecha_creacion: '2026-09-18T14:00:00Z',
    fecha_preparacion: '2026-09-18T14:30:00Z',
    fecha_finalizacion: null,
    items: [],
  },
  {
    id_pedido: 102,
    id_venta: 502,
    id_cliente: 42,
    cliente_nombre: 'Flabia Dominguez',
    cliente_correo: 'flabia@gmail.com',
    estado: 'ENTREGADO',
    modalidad_entrega: 'DELIVERY',
    id_sucursal: 1,
    sucursal: 'Capricho Store Central',
    direccion_sucursal: '2do Anillo La Pirai',
    id_direccion: 5,
    direccion_entrega: 'Av. San Martín #450',
    total: '100.00',
    fecha_creacion: '2026-09-17T14:00:00Z',
    fecha_preparacion: '2026-09-17T14:30:00Z',
    fecha_finalizacion: '2026-09-17T16:00:00Z',
    items: [],
  },
];

describe('OrdersPage', () => {
  it('renders orders list and shows delivery confirmation button only for EN_CAMINO delivery orders', () => {
    const commerceMock = {
      orders: vi.fn(() => of(MOCK_ORDERS)),
      confirmDelivery: vi.fn(),
      orderInvoice: vi.fn(),
    };
    const errorMock = {
      message: vi.fn((err: any, fallback: string) => fallback),
    };

    TestBed.configureTestingModule({
      imports: [OrdersPage],
      providers: [
        { provide: CommerceService, useValue: commerceMock },
        { provide: ApiErrorService, useValue: errorMock },
      ],
    });

    const fixture = TestBed.createComponent(OrdersPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Pedido #101');
    expect(compiled.textContent).toContain('Pedido #102');

    // Only order 101 should have confirm button
    const confirmButtons = compiled.querySelectorAll('.btn-confirm-delivery');
    expect(confirmButtons.length).toBe(1);
    expect(confirmButtons[0].textContent).toContain('Confirmar que recibí mi pedido');
  });

  it('handles user confirming delivery reception', () => {
    const updatedOrder = { ...MOCK_ORDERS[0], estado: 'ENTREGADO' as const };
    const commerceMock = {
      orders: vi.fn(() => of(MOCK_ORDERS)),
      confirmDelivery: vi.fn(() => of(updatedOrder)),
      orderInvoice: vi.fn(),
    };
    const errorMock = {
      message: vi.fn((err: any, fallback: string) => fallback),
    };

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    TestBed.configureTestingModule({
      imports: [OrdersPage],
      providers: [
        { provide: CommerceService, useValue: commerceMock },
        { provide: ApiErrorService, useValue: errorMock },
      ],
    });

    const fixture = TestBed.createComponent(OrdersPage);
    fixture.detectChanges();

    const confirmBtn = fixture.nativeElement.querySelector('.btn-confirm-delivery') as HTMLButtonElement;
    confirmBtn.click();
    fixture.detectChanges();

    expect(commerceMock.confirmDelivery).toHaveBeenCalledWith(101);
    expect(fixture.nativeElement.textContent).toContain('¡Pedido #101 confirmado como recibido con éxito!');
  });
});
