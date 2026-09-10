import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../../core/permissions/permission.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AdminApiService } from './admin-api.service';
import { BranchesAdmin } from './branches-admin';

const branch = {
  id_sucursal: 1,
  id_ciudad: 2,
  ciudad: 'Santa Cruz de la Sierra',
  departamento: 'Santa Cruz',
  pais: 'Bolivia',
  nombre: 'Capricho Store Central',
  direccion: 'Av. Principal 123',
  telefono: '70000000',
  hora_apertura: '09:00:00',
  hora_cierre: '20:00:00',
  activo: true,
};

describe('BranchesAdmin', () => {
  it('lists branches and exposes creation to an authorized administrator', () => {
    const api = {
      list: vi.fn((path: string) =>
        of(
          path === 'branches/admin'
            ? [branch]
            : [
                {
                  id_ciudad: 2,
                  nombre: 'Santa Cruz de la Sierra',
                  departamento: 'Santa Cruz',
                  pais: 'Bolivia',
                },
              ],
        ),
      ),
      post: vi.fn(() => of(branch)),
      patch: vi.fn(() => of(branch)),
    };
    TestBed.configureTestingModule({
      imports: [BranchesAdmin],
      providers: [
        { provide: AdminApiService, useValue: api },
        { provide: PermissionService, useValue: { has: () => true } },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });

    const fixture = TestBed.createComponent(BranchesAdmin);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Capricho Store Central');
    expect(element.textContent).toContain('09:00–20:00');
    expect(element.textContent).toContain('Nueva sucursal');
  });

  it('rejects a closing time earlier than opening time', () => {
    TestBed.configureTestingModule({
      imports: [BranchesAdmin],
      providers: [
        { provide: AdminApiService, useValue: { list: () => of([]) } },
        { provide: PermissionService, useValue: { has: () => true } },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });
    const fixture = TestBed.createComponent(BranchesAdmin);
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    fixture.componentInstance.form.patchValue({
      hora_apertura: '20:00',
      hora_cierre: '09:00',
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.form.hasError('invalidSchedule')).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'La hora de cierre debe ser posterior',
    );
  });

  it('explains required fields after an invalid save attempt', () => {
    TestBed.configureTestingModule({
      imports: [BranchesAdmin],
      providers: [
        { provide: AdminApiService, useValue: { list: () => of([]) } },
        { provide: PermissionService, useValue: { has: () => true } },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });
    const fixture = TestBed.createComponent(BranchesAdmin);
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    fixture.componentInstance.save();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Escribe el nombre.');
    expect(element.textContent).toContain('Selecciona una ciudad.');
    expect(element.querySelector('#branch-name')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps creation and editing hidden in read-only mode', () => {
    TestBed.configureTestingModule({
      imports: [BranchesAdmin],
      providers: [
        {
          provide: AdminApiService,
          useValue: { list: (path: string) => of(path === 'branches/admin' ? [branch] : []) },
        },
        { provide: PermissionService, useValue: { has: () => false } },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });
    const fixture = TestBed.createComponent(BranchesAdmin);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).not.toContain('Nueva sucursal');
    expect(text).not.toContain('Editar');
    expect(text).toContain('Solo lectura');
  });
});
