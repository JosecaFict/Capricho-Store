import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import {
  AdminNotificationPage,
  AdminOperationalNotification,
} from '../../core/models/commerce.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CommerceService } from '../../core/services/commerce.service';
import { NotificationsAdmin } from './notifications-admin';

const SAMPLE_NOTIFICATION: AdminOperationalNotification = {
  id_notificacion: 101,
  id_usuario: 5,
  destinatario_nombre: 'Valeria Soliz',
  destinatario_email: 'valeria@example.com',
  tipo: 'PEDIDO_EN_RUTA',
  canal: 'EMAIL',
  proveedor: 'BREVO',
  destinatario: 'valeria@example.com',
  titulo: 'Tu pedido está en camino',
  contenido: 'El pedido #45 ha salido para despacho.',
  estado: 'ENVIADO',
  external_message_id: 'brevo-msg-99',
  fecha_creacion: '2026-09-13T10:00:00Z',
  fecha_envio: '2026-09-13T10:00:05Z',
  fecha_entrega: '2026-09-13T10:00:10Z',
  error_mensaje: null,
};

const SAMPLE_PAGE: AdminNotificationPage = {
  items: [SAMPLE_NOTIFICATION],
  total: 1,
  kpis: {
    total: 1,
    enviadas: 1,
    pendientes: 0,
    fallidas: 0,
  },
  page: 1,
  page_size: 50,
};

describe('NotificationsAdmin', () => {
  it('renders operational notifications table and KPIs', () => {
    const commerceMock = {
      adminNotifications: vi.fn(() => of(SAMPLE_PAGE)),
      adminCustomers: vi.fn(() => of([])),
      sendManualNotification: vi.fn(),
      resendNotification: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [NotificationsAdmin],
      providers: [
        { provide: CommerceService, useValue: commerceMock },
        { provide: ApiErrorService, useValue: { message: vi.fn(() => 'Error') } },
      ],
    });

    const fixture = TestBed.createComponent(NotificationsAdmin);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Notificaciones Operativas');
    expect(el.textContent).toContain('Total Emitidas');
    expect(el.textContent).toContain('Valeria Soliz');
    expect(el.textContent).toContain('Tu pedido está en camino');
    expect(el.textContent).toContain('ENVIADO');
    expect(commerceMock.adminNotifications).toHaveBeenCalled();
  });

  it('opens detail modal when clicking Detalle button', () => {
    const commerceMock = {
      adminNotifications: vi.fn(() => of(SAMPLE_PAGE)),
      adminCustomers: vi.fn(() => of([])),
      sendManualNotification: vi.fn(),
      resendNotification: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [NotificationsAdmin],
      providers: [
        { provide: CommerceService, useValue: commerceMock },
        { provide: ApiErrorService, useValue: { message: vi.fn(() => 'Error') } },
      ],
    });

    const fixture = TestBed.createComponent(NotificationsAdmin);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const detailBtn = el.querySelector<HTMLButtonElement>('button[title="Ver detalle de notificación"]');
    expect(detailBtn).toBeTruthy();
    detailBtn?.click();
    fixture.detectChanges();

    expect(el.textContent).toContain('Auditoría y trazabilidad del despacho operativo');
    expect(el.textContent).toContain('brevo-msg-99');
  });
});
