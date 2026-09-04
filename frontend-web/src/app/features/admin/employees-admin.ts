import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiErrorService } from '../../core/services/api-error.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { AdminApiService, Entity } from './admin-api.service';

@Component({
  selector: 'app-employees-admin',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: ` <div class="admin-page">
    <header class="admin-page-heading">
      <div>
        <p class="eyebrow">Personal</p>
        <h1>Empleados</h1>
        <p>Usuarios laborales, sucursal, estado y alcance operativo.</p>
      </div>
      @if (canCreate()) {
        <button class="button button--primary" (click)="openCreate()">Nuevo empleado</button>
      }
    </header>
    @if (message()) {
      <div class="notice" [class.notice--error]="isError()" role="status">{{ message() }}</div>
    }
    @if (showForm()) {
      <section class="admin-editor">
        <header>
          <h2>{{ editingId() ? 'Editar empleado' : 'Crear empleado' }}</h2>
          <button class="button button--quiet" (click)="closeForm()">Cerrar</button>
        </header>
        <form [formGroup]="form" (ngSubmit)="save()" class="admin-form-grid">
          @for (f of textFields; track f.key) {
            <label class="field"
              ><span>{{ f.label }}</span
              ><input
                [type]="f.type"
                [formControlName]="f.key"
                [attr.required]="f.required || null"
            /></label>
          }
          <label class="field"
            ><span>ID sucursal</span><input type="number" min="1" formControlName="id_sucursal"
          /></label>
          @if (!editingId()) {
            <label class="field"
              ><span>Rol</span
              ><select formControlName="id_rol">
                <option value="">Seleccionar</option>
                @for (r of roles(); track r['id_rol']) {
                  <option [value]="r['id_rol']">{{ r['nombre'] }}</option>
                }
              </select></label
            >
          }
          <label class="field"
            ><span>Cargo descriptivo</span><input formControlName="cargo_descriptivo" /></label
          ><label class="field"
            ><span>Fecha de contratación</span
            ><input type="date" formControlName="fecha_contratacion"
          /></label>
          @if (editingId()) {
            <label class="field"
              ><span>Estado laboral</span
              ><select formControlName="estado_laboral">
                <option>ACTIVO</option>
                <option>INACTIVO</option>
                <option>SUSPENDIDO</option>
              </select></label
            >
          }
          <div class="admin-form-actions">
            <button class="button button--primary" [disabled]="form.invalid || saving()">
              {{ saving() ? 'Guardando…' : 'Guardar empleado' }}
            </button>
          </div>
        </form>
      </section>
    }
    @if (loading()) {
      <div class="admin-skeleton" aria-label="Cargando"></div>
    } @else {
      <div class="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Sucursal</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (e of employees(); track e['id_empleado']) {
              <tr>
                <td>
                  <strong>{{ e['nombres'] }} {{ e['apellidos'] }}</strong
                  ><small>{{ e['correo'] }} · CI {{ e['ci'] }}</small>
                </td>
                <td>{{ e['sucursal'] }}</td>
                <td>{{ e['roles']?.join(', ') || 'Sin rol' }}</td>
                <td>
                  <span
                    class="status-chip"
                    [class.status-chip--muted]="e['estado_laboral'] !== 'ACTIVO'"
                    >{{ e['estado_laboral'] }}</span
                  >
                </td>
                <td class="admin-row-actions">
                  <a [routerLink]="['/admin/empleados', e['id_empleado']]">Ver</a>
                  @if (canEdit()) {
                    <button (click)="edit(e)">Editar</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5">No hay empleados registrados.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  </div>`,
})
export class EmployeesAdmin implements OnInit {
  private api = inject(AdminApiService);
  private errors = inject(ApiErrorService);
  private perms = inject(PermissionService);
  private fb = inject(FormBuilder);
  employees = signal<Entity[]>([]);
  roles = signal<Entity[]>([]);
  loading = signal(true);
  saving = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);
  message = signal('');
  isError = signal(false);
  canCreate = computed(() => this.perms.has('empleados.crear'));
  canEdit = computed(() => this.perms.has('empleados.editar'));
  textFields = [
    { key: 'nombres', label: 'Nombres', type: 'text', required: true },
    { key: 'apellidos', label: 'Apellidos', type: 'text', required: true },
    { key: 'correo', label: 'Correo', type: 'email', required: true },
    { key: 'telefono', label: 'Teléfono', type: 'tel', required: false },
    { key: 'ci', label: 'CI', type: 'text', required: true },
    { key: 'password', label: 'Contraseña', type: 'password', required: true },
  ] as const;
  form = this.fb.group({
    nombres: ['', Validators.required],
    apellidos: ['', Validators.required],
    correo: ['', [Validators.required, Validators.email]],
    telefono: [''],
    ci: ['', Validators.required],
    password: [''],
    id_sucursal: [null as number | null, Validators.required],
    id_rol: [null as number | null],
    cargo_descriptivo: [''],
    fecha_contratacion: [''],
    estado_laboral: ['ACTIVO'],
  });
  ngOnInit() {
    this.reload();
    if (this.perms.has('permisos.asignar'))
      this.api.list('roles').subscribe({ next: (v) => this.roles.set(v) });
  }
  reload() {
    this.loading.set(true);
    this.api.list('employees').subscribe({
      next: (v) => {
        this.employees.set(v);
        this.loading.set(false);
      },
      error: (e) => {
        this.fail(e);
        this.loading.set(false);
      },
    });
  }
  openCreate() {
    this.editingId.set(null);
    this.form.reset({ estado_laboral: 'ACTIVO' });
    this.form.controls.password.addValidators([Validators.required, Validators.minLength(8)]);
    this.form.controls.id_rol.addValidators(Validators.required);
    this.showForm.set(true);
  }
  edit(e: Entity) {
    this.editingId.set(e['id_empleado']);
    this.form.controls.password.clearValidators();
    this.form.controls.id_rol.clearValidators();
    this.form.patchValue(e as any);
    this.showForm.set(true);
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  closeForm() {
    this.showForm.set(false);
  }
  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const raw = this.form.getRawValue() as Entity;
    const payload = Object.fromEntries(
      Object.entries(raw).filter(
        ([k, v]) =>
          v !== '' && v !== null && (!this.editingId() || !['password', 'id_rol'].includes(k)),
      ),
    );
    const req = this.editingId()
      ? this.api.patch(`employees/${this.editingId()}`, payload)
      : this.api.post('employees', payload);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.ok('Empleado guardado correctamente.');
        this.reload();
      },
      error: (e) => {
        this.saving.set(false);
        this.fail(e);
      },
    });
  }
  ok(m: string) {
    this.isError.set(false);
    this.message.set(m);
  }
  fail(e: unknown) {
    this.isError.set(true);
    this.message.set(this.errors.message(e));
  }
}

@Component({
  selector: 'app-employee-detail',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: ` <div class="admin-page">
    <a class="back-link" routerLink="/admin/empleados">← Empleados</a>
    @if (employee(); as e) {
      <header class="admin-page-heading">
        <div>
          <p class="eyebrow">Empleado #{{ e['id_empleado'] }}</p>
          <h1>{{ e['nombres'] }} {{ e['apellidos'] }}</h1>
          <p>{{ e['correo'] }} · {{ e['sucursal'] }}</p>
        </div>
        <span class="status-chip">{{ e['estado_laboral'] }}</span>
      </header>
      <div class="admin-detail-grid">
        <section class="admin-panel">
          <h2>Perfil laboral</h2>
          <dl class="admin-definition">
            <div>
              <dt>CI</dt>
              <dd>{{ e['ci'] }}</dd>
            </div>
            <div>
              <dt>Cargo</dt>
              <dd>{{ e['cargo_descriptivo'] || 'Sin especificar' }}</dd>
            </div>
            <div>
              <dt>Contratación</dt>
              <dd>{{ e['fecha_contratacion'] | date }}</dd>
            </div>
            <div>
              <dt>Rol actual</dt>
              <dd>{{ e['roles']?.join(', ') }}</dd>
            </div>
          </dl>
        </section>
        @if (canAssign()) {
          <section class="admin-panel">
            <h2>Rol y permisos</h2>
            <form [formGroup]="roleForm" (ngSubmit)="changeRole()" class="admin-inline-form">
              <label class="field"
                ><span>Asignar rol</span
                ><select formControlName="id_rol">
                  <option value="">Seleccionar</option>
                  @for (r of roles(); track r['id_rol']) {
                    <option [value]="r['id_rol']">{{ r['nombre'] }}</option>
                  }
                </select></label
              ><button class="button button--secondary" [disabled]="roleForm.invalid">
                Cambiar rol
              </button>
            </form>
            @if (summary(); as s) {
              <div class="permission-summary">
                <p>
                  <strong>Heredados:</strong> {{ s['permisos_heredados']?.join(', ') || 'Ninguno' }}
                </p>
                <p>
                  <strong>Otorgados:</strong>
                  {{ s['permisos_individuales_otorgados']?.join(', ') || 'Ninguno' }}
                </p>
                <p>
                  <strong>Revocados:</strong>
                  {{ s['permisos_individuales_revocados']?.join(', ') || 'Ninguno' }}
                </p>
              </div>
              <div class="permission-list">
                @for (p of permissions(); track p['id_permiso']) {
                  <div>
                    <span
                      ><strong>{{ p['nombre'] }}</strong
                      ><small>{{ p['codigo'] }} · {{ p['modulo'] }}</small></span
                    ><span class="admin-row-actions"
                      ><button (click)="override(p, true)">Otorgar</button
                      ><button (click)="override(p, false)">Revocar</button></span
                    >
                  </div>
                }
              </div>
            }
          </section>
        }
      </div>
    } @else {
      <div class="admin-skeleton"></div>
    }
    @if (message()) {
      <div class="notice" [class.notice--error]="isError()">{{ message() }}</div>
    }
  </div>`,
})
export class EmployeeDetail implements OnInit {
  private api = inject(AdminApiService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private errors = inject(ApiErrorService);
  private perms = inject(PermissionService);
  id = Number(this.route.snapshot.paramMap.get('id'));
  employee = signal<Entity | null>(null);
  roles = signal<Entity[]>([]);
  permissions = signal<Entity[]>([]);
  summary = signal<Entity | null>(null);
  message = signal('');
  isError = signal(false);
  canAssign = computed(() => this.perms.has('permisos.asignar'));
  roleForm = this.fb.group({ id_rol: [null as number | null, Validators.required] });
  ngOnInit() {
    this.load();
  }
  load() {
    const calls: any = { employee: this.api.get(`employees/${this.id}`) };
    if (this.canAssign()) {
      calls.roles = this.api.list('roles');
      calls.permissions = this.api.list('permissions');
      calls.summary = this.api.get(`employees/${this.id}/permissions`);
    }
    forkJoin(calls).subscribe({
      next: (v: any) => {
        this.employee.set(v.employee);
        this.roles.set(v.roles ?? []);
        this.permissions.set(v.permissions ?? []);
        this.summary.set(v.summary ?? null);
      },
      error: (e) => this.fail(e),
    });
  }
  changeRole() {
    this.api.put(`employees/${this.id}/role`, this.roleForm.getRawValue()).subscribe({
      next: () => {
        this.ok('Rol actualizado.');
        this.load();
      },
      error: (e) => this.fail(e),
    });
  }
  override(p: Entity, otorgado: boolean) {
    this.api.put(`employees/${this.id}/permissions/${p['id_permiso']}`, { otorgado }).subscribe({
      next: (v) => {
        this.summary.set(v);
        this.ok(otorgado ? 'Permiso otorgado.' : 'Permiso revocado.');
      },
      error: (e) => this.fail(e),
    });
  }
  ok(m: string) {
    this.isError.set(false);
    this.message.set(m);
  }
  fail(e: unknown) {
    this.isError.set(true);
    this.message.set(this.errors.message(e));
  }
}
