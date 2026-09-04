import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiErrorService } from '../../core/services/api-error.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { AdminApiService, Entity } from './admin-api.service';

abstract class BaseAdmin {
  protected api = inject(AdminApiService);
  protected fb = inject(FormBuilder);
  protected errs = inject(ApiErrorService);
  message = signal('');
  error = signal(false);
  ok(m: string) {
    this.error.set(false);
    this.message.set(m);
  }
  fail(e: unknown) {
    this.error.set(true);
    this.message.set(this.errs.message(e));
  }
}

@Component({
  selector: 'app-suppliers-admin',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `<div class="admin-page">
    <header class="admin-page-heading">
      <div>
        <p class="eyebrow">Compras</p>
        <h1>Proveedores</h1>
        <p>Contactos comerciales y productos asociados.</p>
      </div>
      @if (canManage()) {
        <button class="button button--primary" (click)="open()">Nuevo proveedor</button>
      }
    </header>
    @if (message()) {
      <div class="notice" [class.notice--error]="error()">{{ message() }}</div>
    }
    @if (show()) {
      <section class="admin-editor">
        <header>
          <h2>{{ editing() ? 'Editar' : 'Crear' }} proveedor</h2>
          <button class="button button--quiet" (click)="show.set(false)">Cerrar</button>
        </header>
        <form [formGroup]="form" (ngSubmit)="save()" class="admin-form-grid">
          @for (f of fields; track f[0]) {
            <label class="field"
              ><span>{{ f[1] }}</span
              ><input [type]="f[2]" [formControlName]="f[0]"
            /></label>
          }
          <label class="check-field"
            ><input type="checkbox" formControlName="activo" /> Activo</label
          ><button class="button button--primary" [disabled]="form.invalid">Guardar</button>
        </form>
      </section>
    }
    <div class="admin-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>NIT</th>
            <th>Contacto</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          @for (s of items(); track s['id_proveedor']) {
            <tr>
              <td>
                <strong>{{ s['razon_social'] }}</strong
                ><small>{{ s['nombre_comercial'] || '—' }}</small>
              </td>
              <td>{{ s['nit'] || '—' }}</td>
              <td>{{ s['correo'] || s['telefono'] || '—' }}</td>
              <td>{{ s['activo'] ? 'ACTIVO' : 'INACTIVO' }}</td>
              <td class="admin-row-actions">
                <a [routerLink]="['/admin/proveedores', s['id_proveedor']]">Productos</a>
                @if (canManage()) {
                  <button (click)="edit(s)">Editar</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  </div>`,
})
export class SuppliersAdmin extends BaseAdmin implements OnInit {
  private perms = inject(PermissionService);
  items = signal<Entity[]>([]);
  show = signal(false);
  editing = signal<number | null>(null);
  canManage = () => this.perms.has('proveedores.gestionar');
  fields = [
    ['razon_social', 'Razón social', 'text'],
    ['nombre_comercial', 'Nombre comercial', 'text'],
    ['nit', 'NIT', 'text'],
    ['telefono', 'Teléfono', 'tel'],
    ['correo', 'Correo', 'email'],
    ['direccion', 'Dirección', 'text'],
    ['nombre_contacto', 'Nombre de contacto', 'text'],
    ['telefono_contacto', 'Teléfono contacto', 'tel'],
    ['correo_contacto', 'Correo contacto', 'email'],
  ] as const;
  form = this.fb.group({
    razon_social: ['', Validators.required],
    nombre_comercial: [''],
    nit: [''],
    telefono: [''],
    correo: [''],
    direccion: [''],
    nombre_contacto: [''],
    telefono_contacto: [''],
    correo_contacto: [''],
    activo: [true],
  });
  ngOnInit() {
    this.load();
  }
  load() {
    this.api
      .list('suppliers')
      .subscribe({ next: (v) => this.items.set(v), error: (e) => this.fail(e) });
  }
  open() {
    this.editing.set(null);
    this.form.reset({ activo: true });
    this.show.set(true);
  }
  edit(x: Entity) {
    this.editing.set(x['id_proveedor']);
    this.form.patchValue(x as any);
    this.show.set(true);
  }
  save() {
    const req = this.editing()
      ? this.api.patch(`suppliers/${this.editing()}`, this.form.getRawValue())
      : this.api.post('suppliers', this.form.getRawValue());
    req.subscribe({
      next: () => {
        this.show.set(false);
        this.load();
        this.ok('Proveedor guardado.');
      },
      error: (e) => this.fail(e),
    });
  }
}

@Component({
  selector: 'app-supplier-detail',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `<div class="admin-page">
    <a class="back-link" routerLink="/admin/proveedores">← Proveedores</a>
    @if (supplier(); as s) {
      <header class="admin-page-heading">
        <div>
          <p class="eyebrow">Proveedor #{{ s['id_proveedor'] }}</p>
          <h1>{{ s['razon_social'] }}</h1>
          <p>{{ s['nombre_comercial'] || 'Sin nombre comercial' }}</p>
        </div>
      </header>
      <section class="admin-panel">
        <h2>Productos asociados</h2>
        <form [formGroup]="form" (ngSubmit)="add()" class="admin-inline-form">
          <label class="field"
            ><span>ID producto</span
            ><input type="number" min="1" formControlName="id_producto" /></label
          ><label class="field"
            ><span>Código del proveedor</span><input formControlName="codigo_proveedor" /></label
          ><button class="button button--primary">Asociar</button>
        </form>
        <div class="permission-list">
          @for (p of products(); track p['id_producto']) {
            <div>
              <span
                ><strong>{{ p['producto'] }}</strong
                ><small>{{ p['codigo_proveedor'] || 'Sin código externo' }}</small></span
              ><button class="button button--quiet" (click)="remove(p['id_producto'])">
                Quitar asociación
              </button>
            </div>
          } @empty {
            <p>No hay productos asociados.</p>
          }
        </div>
        <p class="admin-help">
          Quitar solo elimina la relación proveedor–producto; no elimina ninguna entidad.
        </p>
      </section>
    }
    @if (message()) {
      <div class="notice" [class.notice--error]="error()">{{ message() }}</div>
    }
  </div>`,
})
export class SupplierDetail extends BaseAdmin implements OnInit {
  private route = inject(ActivatedRoute);
  id = Number(this.route.snapshot.paramMap.get('id'));
  supplier = signal<Entity | null>(null);
  products = signal<Entity[]>([]);
  form = this.fb.group({
    id_producto: [null as number | null, Validators.required],
    codigo_proveedor: [''],
  });
  ngOnInit() {
    this.load();
  }
  load() {
    this.api
      .get(`suppliers/${this.id}`)
      .subscribe({ next: (v) => this.supplier.set(v), error: (e) => this.fail(e) });
    this.api
      .list(`suppliers/${this.id}/products`)
      .subscribe({ next: (v) => this.products.set(v), error: (e) => this.fail(e) });
  }
  add() {
    const v = this.form.getRawValue();
    this.api
      .post(`suppliers/${this.id}/products/${v.id_producto}`, {
        codigo_proveedor: v.codigo_proveedor || null,
      })
      .subscribe({
        next: () => {
          this.load();
          this.ok('Producto asociado.');
        },
        error: (e) => this.fail(e),
      });
  }
  remove(id: number) {
    this.api.delete(`suppliers/${this.id}/products/${id}`).subscribe({
      next: () => {
        this.load();
        this.ok('Asociación eliminada.');
      },
      error: (e) => this.fail(e),
    });
  }
}

@Component({
  selector: 'app-purchases-admin',
  imports: [CommonModule, ReactiveFormsModule],
  template: `<div class="admin-page">
    <header class="admin-page-heading">
      <div>
        <p class="eyebrow">Compras</p>
        <h1>Órdenes de compra</h1>
        <p>Solicitud, seguimiento y recepción de mercadería.</p>
      </div>
      @if (canManage()) {
        <button class="button button--primary" (click)="show.set(!show())">Nueva orden</button>
      }
    </header>
    @if (message()) {
      <div class="notice" [class.notice--error]="error()">{{ message() }}</div>
    }
    @if (show()) {
      <section class="admin-editor">
        <header><h2>Nueva orden</h2></header>
        <form [formGroup]="form" (ngSubmit)="save()" class="admin-form-grid">
          <label class="field"
            ><span>ID proveedor</span
            ><input type="number" min="1" formControlName="id_proveedor" /></label
          ><label class="field"
            ><span>ID sucursal</span
            ><input type="number" min="1" formControlName="id_sucursal" /></label
          ><label class="field"
            ><span>Fecha estimada</span
            ><input type="date" formControlName="fecha_estimada" /></label
          ><label class="field field--wide"
            ><span>Observación</span><textarea formControlName="observacion"></textarea>
          </label>
          <div formArrayName="detalles" class="admin-repeater field--wide">
            @for (row of details.controls; track $index) {
              <div [formGroupName]="$index">
                <label class="field"
                  ><span>ID variante</span
                  ><input type="number" formControlName="id_variante" /></label
                ><label class="field"
                  ><span>Cantidad</span
                  ><input type="number" min="1" formControlName="cantidad" /></label
                ><label class="field"
                  ><span>Costo estimado</span
                  ><input
                    type="number"
                    min="0"
                    step=".01"
                    formControlName="costo_unitario_estimado" /></label
                ><button
                  type="button"
                  class="button button--quiet"
                  (click)="details.removeAt($index)"
                >
                  Quitar
                </button>
              </div>
            }
          </div>
          <div class="admin-form-actions">
            <button type="button" class="button button--secondary" (click)="addRow()">
              Añadir línea</button
            ><button class="button button--primary" [disabled]="form.invalid">Crear orden</button>
          </div>
        </form>
      </section>
    }
    <div class="admin-card-list">
      @for (o of orders(); track o['id_orden_compra']) {
        <article>
          <header>
            <div>
              <span class="eyebrow">Orden #{{ o['id_orden_compra'] }}</span>
              <h2>{{ o['estado'] }}</h2>
            </div>
            <span>{{ o['fecha_orden'] | date: 'mediumDate' }}</span>
          </header>
          <p>
            Proveedor {{ o['id_proveedor'] }} · Sucursal {{ o['id_sucursal'] }} ·
            {{ o['detalles']?.length }} líneas
          </p>
          @if (canManage()) {
            <div class="admin-row-actions">
              @for (state of nextStates(o['estado']); track state) {
                <button (click)="setState(o, state)">{{ state }}</button>
              }
            </div>
          }
        </article>
      }
    </div>
  </div>`,
})
export class PurchasesAdmin extends BaseAdmin implements OnInit {
  private permissions = inject(PermissionService);
  canManage = () => this.permissions.has('proveedores.gestionar');
  orders = signal<Entity[]>([]);
  show = signal(false);
  form = this.fb.group({
    id_proveedor: [null as number | null, Validators.required],
    id_sucursal: [null as number | null, Validators.required],
    fecha_estimada: [''],
    observacion: [''],
    detalles: this.fb.array([]),
  });
  get details() {
    return this.form.controls.detalles as FormArray;
  }
  ngOnInit() {
    this.load();
    this.addRow();
  }
  load() {
    this.api
      .list('purchase-orders')
      .subscribe({ next: (v) => this.orders.set(v), error: (e) => this.fail(e) });
  }
  addRow() {
    this.details.push(
      this.fb.group({
        id_variante: [null, Validators.required],
        cantidad: [1, [Validators.required, Validators.min(1)]],
        costo_unitario_estimado: [null],
      }),
    );
  }
  save() {
    this.api.post('purchase-orders', this.form.getRawValue()).subscribe({
      next: () => {
        this.show.set(false);
        this.load();
        this.ok('Orden creada.');
      },
      error: (e) => this.fail(e),
    });
  }
  nextStates(s: string) {
    return (
      (
        {
          SOLICITADA: ['CONFIRMADA', 'CANCELADA'],
          CONFIRMADA: ['EN_TRANSITO', 'CANCELADA'],
          EN_TRANSITO: ['CANCELADA'],
          PARCIAL: [],
          RECIBIDA: [],
          CANCELADA: [],
        } as any
      )[s] ?? []
    );
  }
  setState(o: Entity, estado: string) {
    this.api
      .patch(`purchase-orders/${o['id_orden_compra']}`, { estado })
      .subscribe({ next: () => this.load(), error: (e) => this.fail(e) });
  }
}

@Component({
  selector: 'app-receipts-admin',
  imports: [CommonModule, ReactiveFormsModule],
  template: `<div class="admin-page">
    <header class="admin-page-heading">
      <div>
        <p class="eyebrow">Compras</p>
        <h1>Recepciones</h1>
        <p>Registro transaccional de cantidades y costos recibidos.</p>
      </div>
      <button class="button button--primary" (click)="show.set(!show())">
        Registrar recepción
      </button>
    </header>
    @if (message()) {
      <div class="notice" [class.notice--error]="error()">{{ message() }}</div>
    }
    @if (show()) {
      <section class="admin-editor">
        <form [formGroup]="form" (ngSubmit)="save()" class="admin-form-grid">
          <label class="field"
            ><span>ID orden de compra</span
            ><input type="number" min="1" formControlName="id_orden_compra" /></label
          ><label class="field field--wide"
            ><span>Observación</span><textarea formControlName="observacion"></textarea>
          </label>
          <div formArrayName="detalles" class="admin-repeater field--wide">
            @for (row of details.controls; track $index) {
              <div [formGroupName]="$index">
                <label class="field"
                  ><span>ID variante</span
                  ><input type="number" formControlName="id_variante" /></label
                ><label class="field"
                  ><span>Cantidad recibida</span
                  ><input type="number" min="1" formControlName="cantidad_recibida" /></label
                ><label class="field"
                  ><span>Costo unitario</span
                  ><input
                    type="number"
                    min="0"
                    step=".01"
                    formControlName="costo_unitario" /></label
                ><label class="field"
                  ><span>Número de lote</span><input formControlName="numero_lote"
                /></label>
              </div>
            }
          </div>
          <div class="admin-form-actions">
            <button type="button" class="button button--secondary" (click)="addRow()">
              Añadir línea</button
            ><button class="button button--primary">Confirmar recepción</button>
          </div>
        </form>
      </section>
    }
    <div class="admin-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Recepción</th>
            <th>Orden</th>
            <th>Sucursal</th>
            <th>Fecha</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          @for (r of items(); track r['id_recepcion']) {
            <tr>
              <td>#{{ r['id_recepcion'] }}</td>
              <td>#{{ r['id_orden_compra'] }}</td>
              <td>{{ r['id_sucursal'] }}</td>
              <td>{{ r['fecha_recepcion'] | date: 'short' }}</td>
              <td>{{ r['estado'] }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  </div>`,
})
export class ReceiptsAdmin extends BaseAdmin implements OnInit {
  items = signal<Entity[]>([]);
  show = signal(false);
  form = this.fb.group({
    id_orden_compra: [null as number | null, Validators.required],
    observacion: [''],
    detalles: this.fb.array([]),
  });
  get details() {
    return this.form.controls.detalles as FormArray;
  }
  ngOnInit() {
    this.load();
    this.addRow();
  }
  load() {
    this.api
      .list('receipts')
      .subscribe({ next: (v) => this.items.set(v), error: (e) => this.fail(e) });
  }
  addRow() {
    this.details.push(
      this.fb.group({
        id_variante: [null, Validators.required],
        cantidad_recibida: [1, [Validators.required, Validators.min(1)]],
        costo_unitario: [0, [Validators.required, Validators.min(0)]],
        numero_lote: [''],
      }),
    );
  }
  save() {
    this.api.post('receipts', this.form.getRawValue()).subscribe({
      next: () => {
        this.show.set(false);
        this.load();
        this.ok('Recepción registrada.');
      },
      error: (e) => this.fail(e),
    });
  }
}

@Component({
  selector: 'app-inventory-admin',
  imports: [CommonModule, ReactiveFormsModule],
  template: `<div class="admin-page">
    <header class="admin-page-heading">
      <div>
        <p class="eyebrow">Inventario</p>
        <h1>Existencias</h1>
        <p>Stock físico, reservado y disponible por variante y sucursal.</p>
      </div>
    </header>
    <form [formGroup]="filters" (ngSubmit)="load()" class="admin-filterbar">
      <label class="field"
        ><span>Sucursal</span><input type="number" formControlName="sucursal" /></label
      ><label class="check-field"
        ><input type="checkbox" formControlName="stock_bajo" /> Solo stock bajo</label
      ><label class="check-field"
        ><input type="checkbox" formControlName="agotado" /> Solo agotado</label
      ><button class="button button--secondary">Aplicar</button>
    </form>
    @if (message()) {
      <div class="notice" [class.notice--error]="error()">{{ message() }}</div>
    }
    <div class="admin-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Sucursal</th>
            <th>Físico</th>
            <th>Reservado</th>
            <th>Disponible</th>
            <th>Mínimo</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          @for (i of items(); track i['id_inventario']) {
            <tr>
              <td>
                <strong>{{ i['producto'] }}</strong
                ><small>{{ i['sku'] }} · {{ i['talla'] }} · {{ i['color'] }}</small>
              </td>
              <td>{{ i['sucursal'] }}</td>
              <td>{{ i['stock_fisico'] }}</td>
              <td>{{ i['stock_reservado'] }}</td>
              <td>{{ i['stock_disponible'] }}</td>
              <td>{{ i['stock_minimo'] }}</td>
              <td>
                <span class="status-chip">{{ i['estado_stock'] }}</span>
              </td>
              <td class="admin-row-actions">
                @if (canMove()) {
                  <button (click)="select(i)">Gestionar</button>
                } @else {
                  <span>Solo lectura</span>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    @if (selected(); as i) {
      <section class="admin-editor">
        <header>
          <h2>{{ i['producto'] }} · {{ i['sku'] }}</h2>
          <button class="button button--quiet" (click)="selected.set(null)">Cerrar</button>
        </header>
        <div class="admin-detail-grid">
          <form [formGroup]="minimum" (ngSubmit)="saveMinimum(i)" class="admin-inline-form">
            <label class="field"
              ><span>Stock mínimo</span
              ><input type="number" min="0" formControlName="stock_minimo" /></label
            ><button class="button button--secondary">Actualizar</button>
          </form>
          <form
            [formGroup]="adjustment"
            (ngSubmit)="adjust(i)"
            class="admin-form-grid admin-form-grid--two"
          >
            <label class="field"
              ><span>Tipo</span
              ><select formControlName="tipo">
                <option>AJUSTE_POSITIVO</option>
                <option>AJUSTE_NEGATIVO</option>
              </select></label
            ><label class="field"
              ><span>Cantidad</span
              ><input type="number" min="1" formControlName="cantidad" /></label
            ><label class="field field--wide"
              ><span>Motivo obligatorio</span><input formControlName="motivo" /></label
            ><button class="button button--primary" [disabled]="adjustment.invalid">
              Registrar ajuste
            </button>
          </form>
        </div>
        <p class="admin-help">
          El stock físico no se edita directamente; el ajuste genera un movimiento inmutable.
        </p>
      </section>
    }
  </div>`,
})
export class InventoryAdmin extends BaseAdmin implements OnInit {
  private permissions = inject(PermissionService);
  canMove = () => this.permissions.has('inventario.movimiento');
  items = signal<Entity[]>([]);
  selected = signal<Entity | null>(null);
  filters = this.fb.group({
    sucursal: [null as number | null],
    stock_bajo: [false],
    agotado: [false],
  });
  minimum = this.fb.group({ stock_minimo: [0, [Validators.required, Validators.min(0)]] });
  adjustment = this.fb.group({
    tipo: ['AJUSTE_POSITIVO', Validators.required],
    cantidad: [1, [Validators.required, Validators.min(1)]],
    motivo: ['', Validators.required],
  });
  ngOnInit() {
    this.load();
  }
  load() {
    this.api
      .list('inventory', this.filters.getRawValue() as any)
      .subscribe({ next: (v) => this.items.set(v), error: (e) => this.fail(e) });
  }
  select(i: Entity) {
    this.api.get(`inventory/${i['id_inventario']}`).subscribe({
      next: (detail) => {
        this.selected.set(detail);
        this.minimum.patchValue({ stock_minimo: detail['stock_minimo'] });
      },
      error: (e) => this.fail(e),
    });
  }
  saveMinimum(i: Entity) {
    this.api
      .patch(`inventory/${i['id_inventario']}/minimum-stock`, this.minimum.getRawValue())
      .subscribe({
        next: () => {
          this.load();
          this.ok('Stock mínimo actualizado.');
        },
        error: (e) => this.fail(e),
      });
  }
  adjust(i: Entity) {
    this.api
      .post(`inventory/${i['id_inventario']}/adjustments`, this.adjustment.getRawValue())
      .subscribe({
        next: () => {
          this.load();
          this.ok('Ajuste registrado.');
          this.selected.set(null);
        },
        error: (e) => this.fail(e),
      });
  }
}

@Component({
  selector: 'app-trace-admin',
  imports: [CommonModule, ReactiveFormsModule],
  template: `<div class="admin-page">
    <header class="admin-page-heading">
      <div>
        <p class="eyebrow">Inventario · Trazabilidad</p>
        <h1>{{ title() }}</h1>
        <p>{{ description() }}</p>
      </div>
      @if (mode() === 'transfers' && canMove()) {
        <button class="button button--primary" (click)="show.set(!show())">
          Nueva transferencia
        </button>
      }
    </header>
    @if (message()) {
      <div class="notice" [class.notice--error]="error()">{{ message() }}</div>
    }
    @if (show()) {
      <section class="admin-editor">
        <form [formGroup]="transfer" (ngSubmit)="createTransfer()" class="admin-form-grid">
          <label class="field"
            ><span>Sucursal origen</span
            ><input type="number" min="1" formControlName="id_sucursal_origen" /></label
          ><label class="field"
            ><span>Sucursal destino</span
            ><input type="number" min="1" formControlName="id_sucursal_destino" /></label
          ><label class="field"
            ><span>ID variante</span
            ><input type="number" min="1" formControlName="id_variante" /></label
          ><label class="field"
            ><span>Cantidad</span><input type="number" min="1" formControlName="cantidad" /></label
          ><button class="button button--primary">Crear transferencia</button>
        </form>
      </section>
    }
    <div class="admin-card-list">
      @for (x of items(); track identity(x)) {
        <article>
          <header>
            <div>
              <span class="eyebrow">#{{ identity(x) }}</span>
              <h2>{{ primary(x) }}</h2>
            </div>
            <span>{{ dateOf(x) | date: 'short' }}</span>
          </header>
          <p>{{ summary(x) }}</p>
          @if (mode() === 'movements' && x['lotes']?.length) {
            <div class="admin-lot-trace">
              @for (l of x['lotes']; track l['id_lote']) {
                <span
                  >Lote {{ l['id_lote'] }} · {{ l['cantidad'] }} u. · Bs
                  {{ l['costo_unitario'] }}</span
                >
              }
            </div>
          }
          @if (mode() === 'transfers' && canMove()) {
            <div class="admin-row-actions">
              @for (s of transferStates(x['estado']); track s) {
                <button (click)="changeTransfer(x, s)">{{ s }}</button>
              }
            </div>
          }
        </article>
      } @empty {
        <p>No hay registros.</p>
      }
    </div>
  </div>`,
})
export class TraceAdmin extends BaseAdmin implements OnInit {
  private route = inject(ActivatedRoute);
  private permissions = inject(PermissionService);
  canMove = () => this.permissions.has('inventario.movimiento');
  mode = signal('lots');
  items = signal<Entity[]>([]);
  show = signal(false);
  transfer = this.fb.group({
    id_sucursal_origen: [null as number | null, Validators.required],
    id_sucursal_destino: [null as number | null, Validators.required],
    id_variante: [null as number | null, Validators.required],
    cantidad: [1, [Validators.required, Validators.min(1)]],
  });
  ngOnInit() {
    this.route.data.subscribe((d) => {
      this.mode.set(d['mode']);
      this.load();
    });
  }
  title() {
    return this.mode() === 'lots'
      ? 'Lotes'
      : this.mode() === 'movements'
        ? 'Movimientos'
        : 'Transferencias';
  }
  description() {
    return this.mode() === 'lots'
      ? 'Origen histórico, costos y disponibilidad por lote.'
      : this.mode() === 'movements'
        ? 'Registro inmutable de entradas y salidas.'
        : 'Flujo entre sucursales sin exponer controles internos FIFO.';
  }
  path() {
    return this.mode() === 'lots'
      ? 'inventory/lots'
      : this.mode() === 'movements'
        ? 'inventory/movements'
        : 'inventory/transfers';
  }
  load() {
    this.api
      .list(this.path())
      .subscribe({ next: (v) => this.items.set(v), error: (e) => this.fail(e) });
  }
  identity(x: Entity) {
    return x['id_lote'] ?? x['id_movimiento'] ?? x['id_transferencia'];
  }
  primary(x: Entity) {
    return x['tipo_movimiento'] ?? x['estado'] ?? `Lote ${x['numero_lote'] || x['id_lote']}`;
  }
  dateOf(x: Entity) {
    return x['fecha_hora'] ?? x['fecha_solicitud'] ?? x['fecha_ingreso'];
  }
  summary(x: Entity) {
    if (this.mode() === 'lots')
      return `Sucursal ${x['id_sucursal']} · Variante ${x['id_variante']} · ${x['cantidad_disponible']} de ${x['cantidad_inicial']} · Bs ${x['costo_unitario']}`;
    if (this.mode() === 'movements')
      return `Inventario ${x['id_inventario']} · ${x['cantidad']} unidades · ${x['referencia_tipo'] || 'Sin referencia'}`;
    return `Sucursal ${x['id_sucursal_origen']} → ${x['id_sucursal_destino']} · ${x['detalles']?.length} línea(s)`;
  }
  createTransfer() {
    const v = this.transfer.getRawValue();
    const payload = {
      id_sucursal_origen: v.id_sucursal_origen,
      id_sucursal_destino: v.id_sucursal_destino,
      detalles: [{ id_variante: v.id_variante, cantidad: v.cantidad }],
    };
    this.api.post('inventory/transfers', payload).subscribe({
      next: () => {
        this.show.set(false);
        this.load();
        this.ok('Transferencia creada.');
      },
      error: (e) => this.fail(e),
    });
  }
  transferStates(s: string) {
    return (
      (
        {
          SOLICITADA: ['APROBADA', 'CANCELADA'],
          APROBADA: ['EN_TRANSITO', 'CANCELADA'],
          EN_TRANSITO: ['RECIBIDA', 'CANCELADA'],
          RECIBIDA: [],
          CANCELADA: [],
        } as any
      )[s] ?? []
    );
  }
  changeTransfer(x: Entity, estado: string) {
    this.api
      .patch(`inventory/transfers/${x['id_transferencia']}/status`, { estado })
      .subscribe({ next: () => this.load(), error: (e) => this.fail(e) });
  }
}
