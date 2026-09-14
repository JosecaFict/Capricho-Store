import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { OperationalNotification } from '../../../core/models/commerce.model';
import { CommerceService } from '../../../core/services/commerce.service';
import { NotificationBell } from './notification-bell';

const SAMPLE_NOTIFICATIONS: OperationalNotification[] = [
  {
    id_notificacion: 1,
    tipo: 'PAGO_CONFIRMADO',
    titulo: 'Compra confirmada',
    contenido: 'Stripe confirmó el pago de tu pedido #10.',
    estado: 'ENVIADO',
    fecha_creacion: new Date().toISOString(),
  },
  {
    id_notificacion: 2,
    tipo: 'PEDIDO_EN_CAMINO',
    titulo: 'Pedido despachado',
    contenido: 'Tu pedido #10 va en camino con el repartidor.',
    estado: 'ENVIADO',
    fecha_creacion: new Date().toISOString(),
  },
  {
    id_notificacion: 3,
    tipo: 'CAMPAÑA_PROMOCIONAL',
    titulo: '¡20% off en Poleras!',
    contenido: 'Aprovecha nuestra liquidación de primavera.',
    estado: 'ENVIADO',
    fecha_creacion: new Date().toISOString(),
  },
];

describe('NotificationBell', () => {
  it('renders bell button and toggles dropdown with notifications', () => {
    const commerceMock = {
      notifications: vi.fn(() => of(SAMPLE_NOTIFICATIONS)),
    };

    TestBed.configureTestingModule({
      imports: [NotificationBell],
      providers: [
        provideRouter([]),
        { provide: CommerceService, useValue: commerceMock },
      ],
    });

    const fixture = TestBed.createComponent(NotificationBell);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.notification-bell-btn') as HTMLButtonElement;
    expect(button).toBeTruthy();

    // Badge should show count 3
    const badge = fixture.nativeElement.querySelector('.notification-badge');
    expect(badge?.textContent?.trim()).toBe('3');

    // Click button to open dropdown
    button.click();
    fixture.detectChanges();

    const dropdown = fixture.nativeElement.querySelector('.notification-dropdown');
    expect(dropdown).toBeTruthy();

    // Verify notification items rendered
    const items = fixture.nativeElement.querySelectorAll('.notification-item');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toContain('Compra confirmada');
    expect(items[1].textContent).toContain('Pedido despachado');
    expect(items[2].textContent).toContain('20% off en Poleras');

    // Verify icons/badges
    expect(items[0].getAttribute('data-type')).toBe('pago');
    expect(items[1].getAttribute('data-type')).toBe('delivery');
    expect(items[2].getAttribute('data-type')).toBe('campania');

    // Click to close
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notification-dropdown')).toBeNull();
  });
});
