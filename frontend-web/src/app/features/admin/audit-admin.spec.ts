import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AdminApiService } from './admin-api.service';
import { AuditAdmin } from './audit-admin';

const auditItem = {
  id_bitacora: 18,
  id_usuario: 2,
  usuario: 'Jose Carlos Villarreal',
  correo_usuario: 'admin@example.com',
  accion: 'UPDATE',
  modulo: 'SEGURIDAD',
  entidad: 'usuario_permiso',
  id_registro: '9',
  direccion_ip: '127.0.0.1',
  origen: 'WEB',
  request_id: 'request-18',
  fecha_hora: '2026-09-05T10:00:00Z',
};

describe('AuditAdmin', () => {
  it('renders audit records and loads their before/after detail', () => {
    const api = {
      query: vi.fn(() => of({ items: [auditItem], page: 1, page_size: 25, total: 1, pages: 1 })),
      get: vi.fn(() =>
        of({
          ...auditItem,
          id_sesion: 'session-1',
          user_agent: 'vitest',
          datos_anteriores: { otorgado: true },
          datos_nuevos: { otorgado: false },
        }),
      ),
    };

    TestBed.configureTestingModule({
      imports: [AuditAdmin],
      providers: [
        { provide: AdminApiService, useValue: api },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });

    const fixture = TestBed.createComponent(AuditAdmin);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Bitácora de seguridad');
    expect(element.textContent).toContain('Jose Carlos Villarreal');
    expect(element.textContent).toContain('Actualización');

    element.querySelector<HTMLButtonElement>('tbody button')?.click();
    fixture.detectChanges();

    expect(api.get).toHaveBeenCalledWith('audit-logs/18');
    expect(element.textContent).toContain('Datos anteriores');
    expect(element.textContent).toContain('Datos nuevos');
  });
});
