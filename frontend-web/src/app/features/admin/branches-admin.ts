import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { PermissionService } from '../../core/permissions/permission.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AdminApiService, Entity } from './admin-api.service';

function validSchedule(control: AbstractControl): ValidationErrors | null {
  const opening = control.get('hora_apertura')?.value;
  const closing = control.get('hora_cierre')?.value;
  if (Boolean(opening) !== Boolean(closing)) return { incompleteSchedule: true };
  return opening && closing && closing <= opening ? { invalidSchedule: true } : null;
}

@Component({
  selector: 'app-branches-admin',
  imports: [CommonModule, ReactiveFormsModule],
  template: `<div class="admin-page">
    <header class="admin-page-heading">
      <div>
        <h1>Sucursales</h1>
        <p>Ubicaciones que organizan empleados, compras, existencias y transferencias.</p>
      </div>
      @if (canCreate()) {
        <button class="button button--primary" type="button" (click)="openCreate()">
          Nueva sucursal
        </button>
      }
    </header>

    @if (message()) {
      <div
        class="notice"
        [class.notice--error]="isError()"
        [attr.role]="isError() ? 'alert' : 'status'"
      >
        {{ message() }}
      </div>
    }

    @if (loadError()) {
      <section class="admin-state admin-state--inline" role="alert">
        <h2>No pudimos cargar las sucursales</h2>
        <p>{{ loadError() }}</p>
        <button class="button button--secondary" type="button" (click)="load()">Reintentar</button>
      </section>
    }

    @if (showForm()) {
      <section class="admin-editor" aria-labelledby="branch-form-title">
        <header>
          <div>
            <h2 id="branch-form-title">
              {{ editingId() ? 'Editar sucursal' : 'Crear sucursal' }}
            </h2>
            <p class="admin-help">
              La ubicación quedará disponible para empleados y operaciones de inventario.
            </p>
          </div>
          <button class="button button--quiet" type="button" (click)="closeForm()">Cerrar</button>
        </header>

        <form [formGroup]="form" (ngSubmit)="save()" class="admin-form-grid">
          <label class="field">
            <span>Nombre</span>
            <input
              #branchName
              id="branch-name"
              formControlName="nombre"
              maxlength="120"
              autocomplete="organization"
              required
              [attr.aria-invalid]="fieldInvalid('nombre')"
              aria-describedby="branch-name-error"
            />
            @if (fieldInvalid('nombre')) {
              <small id="branch-name-error" class="field-error">Escribe el nombre.</small>
            }
          </label>
          <label class="field">
            <span>Ciudad</span>
            <select
              id="branch-city"
              formControlName="id_ciudad"
              required
              [attr.aria-invalid]="fieldInvalid('id_ciudad')"
              aria-describedby="branch-city-error"
            >
              <option value="">Seleccionar ciudad</option>
              @for (city of cities(); track city['id_ciudad']) {
                <option [value]="city['id_ciudad']">
                  {{ city['nombre'] }} · {{ city['departamento'] }}
                </option>
              }
            </select>
            @if (fieldInvalid('id_ciudad')) {
              <small id="branch-city-error" class="field-error">Selecciona una ciudad.</small>
            }
          </label>
          <label class="field">
            <span>Teléfono</span>
            <input formControlName="telefono" maxlength="30" inputmode="tel" autocomplete="tel" />
          </label>
          <label class="field field--wide">
            <span>Dirección</span>
            <input
              id="branch-address"
              formControlName="direccion"
              maxlength="255"
              autocomplete="street-address"
              required
              [attr.aria-invalid]="fieldInvalid('direccion')"
              aria-describedby="branch-address-error"
            />
            @if (fieldInvalid('direccion')) {
              <small id="branch-address-error" class="field-error">Escribe la dirección.</small>
            }
          </label>
          <label class="field">
            <span>Hora de apertura</span>
            <input
              id="branch-opening"
              type="time"
              formControlName="hora_apertura"
              aria-describedby="branch-schedule-error"
            />
          </label>
          <label class="field">
            <span>Hora de cierre</span>
            <input
              id="branch-closing"
              type="time"
              formControlName="hora_cierre"
              aria-describedby="branch-schedule-error"
            />
          </label>
          <label class="field">
            <span>Latitud opcional</span>
            <input
              id="branch-latitude"
              type="number"
              step="0.000001"
              formControlName="latitud"
              [attr.aria-invalid]="fieldInvalid('latitud')"
              aria-describedby="branch-latitude-error"
            />
            @if (fieldInvalid('latitud')) {
              <small id="branch-latitude-error" class="field-error">
                Debe estar entre −90 y 90.
              </small>
            }
          </label>
          <label class="field">
            <span>Longitud opcional</span>
            <input
              id="branch-longitude"
              type="number"
              step="0.000001"
              formControlName="longitud"
              [attr.aria-invalid]="fieldInvalid('longitud')"
              aria-describedby="branch-longitude-error"
            />
            @if (fieldInvalid('longitud')) {
              <small id="branch-longitude-error" class="field-error">
                Debe estar entre −180 y 180.
              </small>
            }
          </label>
          <label class="field">
            <span>Google Place ID opcional</span>
            <input formControlName="place_id" maxlength="255" />
          </label>
          <label class="check-field">
            <input type="checkbox" formControlName="activo" /> Sucursal activa
          </label>
          <div class="admin-form-actions">
            <button class="button button--primary" [disabled]="saving()">
              {{ saving() ? 'Guardando…' : editingId() ? 'Guardar cambios' : 'Crear sucursal' }}
            </button>
          </div>
          @if (form.hasError('invalidSchedule')) {
            <p id="branch-schedule-error" class="field-error field--wide" role="alert">
              La hora de cierre debe ser posterior a la hora de apertura.
            </p>
          }
          @if (form.hasError('incompleteSchedule')) {
            <p id="branch-schedule-error" class="field-error field--wide" role="alert">
              Completa ambas horas o deja las dos vacías.
            </p>
          }
        </form>
      </section>
    }

    @if (!loadError()) {
      <div
        class="admin-table-wrap"
        [attr.aria-busy]="loading()"
        tabindex="0"
        role="region"
        aria-label="Listado de sucursales; desplázate horizontalmente para ver todas las columnas"
      >
        <table>
          <thead>
            <tr>
              <th>Sucursal</th>
              <th>Ciudad</th>
              <th>Contacto</th>
              <th>Horario</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            @for (branch of branches(); track branch['id_sucursal']) {
              <tr>
                <td>
                  <strong>{{ branch['nombre'] }}</strong>
                  <small>{{ branch['direccion'] }}</small>
                </td>
                <td>
                  {{ branch['ciudad'] }}
                  <small>{{ branch['departamento'] }} · {{ branch['pais'] }}</small>
                </td>
                <td>{{ branch['telefono'] || 'Sin teléfono' }}</td>
                <td>{{ schedule(branch) }}</td>
                <td>
                  <span class="status-chip" [class.status-chip--muted]="!branch['activo']">
                    {{ branch['activo'] ? 'ACTIVA' : 'INACTIVA' }}
                  </span>
                </td>
                <td class="admin-row-actions">
                  @if (canEdit()) {
                    <button class="branch-action" type="button" (click)="edit(branch)">
                      Editar
                    </button>
                  } @else {
                    <span>Solo lectura</span>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="employee-empty">
                  <strong>{{
                    loading() ? 'Cargando sucursales…' : 'No hay sucursales registradas'
                  }}</strong>
                  @if (!loading()) {
                    <span>
                      {{
                        canCreate()
                          ? 'Crea la primera ubicación para comenzar a operar inventario.'
                          : 'No hay ubicaciones disponibles para tu cuenta.'
                      }}
                    </span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  </div>`,
  styles: `
    :host .admin-state--inline {
      margin-block: 2rem;
    }
    :host .branch-action {
      min-width: 44px;
      min-height: 44px;
    }
  `,
})
export class BranchesAdmin implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly errors = inject(ApiErrorService);
  private readonly permissions = inject(PermissionService);

  readonly branches = signal<Entity[]>([]);
  readonly cities = signal<Entity[]>([]);
  readonly showForm = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly message = signal('');
  readonly isError = signal(false);
  readonly loadError = signal('');

  @ViewChild('branchName') private branchName?: ElementRef<HTMLInputElement>;
  private returnFocus: HTMLElement | null = null;

  readonly canCreate = () => this.permissions.has('sucursales.crear');
  readonly canEdit = () => this.permissions.has('sucursales.editar');

  readonly form = this.fb.group(
    {
      id_ciudad: [null as number | null, Validators.required],
      nombre: ['', [Validators.required, Validators.maxLength(120)]],
      direccion: ['', [Validators.required, Validators.maxLength(255)]],
      telefono: ['', Validators.maxLength(30)],
      hora_apertura: [''],
      hora_cierre: [''],
      latitud: [null as number | null, [Validators.min(-90), Validators.max(90)]],
      longitud: [null as number | null, [Validators.min(-180), Validators.max(180)]],
      place_id: ['', Validators.maxLength(255)],
      activo: [true],
    },
    { validators: validSchedule },
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      branches: this.api.list('branches/admin'),
      cities: this.api.list('cities'),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ branches, cities }) => {
          this.branches.set(branches);
          this.cities.set(cities);
        },
        error: (error) => this.loadError.set(this.errors.message(error)),
      });
  }

  openCreate(): void {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.editingId.set(null);
    this.form.reset({ activo: true });
    this.submitted.set(false);
    this.showForm.set(true);
    this.clearMessage();
    this.focusForm();
  }

  edit(branch: Entity): void {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.editingId.set(Number(branch['id_sucursal']));
    this.form.reset({
      id_ciudad: branch['id_ciudad'],
      nombre: branch['nombre'],
      direccion: branch['direccion'],
      telefono: branch['telefono'] ?? '',
      hora_apertura: this.shortTime(branch['hora_apertura']),
      hora_cierre: this.shortTime(branch['hora_cierre']),
      latitud: branch['latitud'],
      longitud: branch['longitud'],
      place_id: branch['place_id'] ?? '',
      activo: branch['activo'],
    });
    this.submitted.set(false);
    this.showForm.set(true);
    this.clearMessage();
    window.scrollTo({ top: 0 });
    this.focusForm();
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.returnFocus?.focus();
    this.returnFocus = null;
  }

  save(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    const payload = {
      ...value,
      telefono: value.telefono?.trim() || null,
      place_id: value.place_id?.trim() || null,
      hora_apertura: value.hora_apertura || null,
      hora_cierre: value.hora_cierre || null,
    };
    const id = this.editingId();
    const request = id
      ? this.api.patch(`branches/${id}`, payload)
      : this.api.post('branches', payload);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.closeForm();
        this.ok(id ? 'Sucursal actualizada.' : 'Sucursal creada.');
        this.load();
      },
      error: (error) => this.fail(error),
    });
  }

  schedule(branch: Entity): string {
    const opening = this.shortTime(branch['hora_apertura']);
    const closing = this.shortTime(branch['hora_cierre']);
    return opening && closing ? `${opening}–${closing}` : 'Sin horario';
  }

  fieldInvalid(name: string): boolean {
    const field = this.form.get(name);
    return Boolean(field?.invalid && (field.touched || this.submitted()));
  }

  private shortTime(value: unknown): string {
    return typeof value === 'string' ? value.slice(0, 5) : '';
  }

  private focusForm(): void {
    requestAnimationFrame(() => this.branchName?.nativeElement.focus());
  }

  private ok(message: string): void {
    this.isError.set(false);
    this.message.set(message);
  }

  private fail(error: unknown): void {
    this.isError.set(true);
    this.message.set(this.errors.message(error));
  }

  private clearMessage(): void {
    this.isError.set(false);
    this.message.set('');
  }
}
