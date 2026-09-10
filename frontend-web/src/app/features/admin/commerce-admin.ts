import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { Branch, Product, ProductVariant } from '../../core/models/catalog.model';
import { Order, Reservation, ReturnRequest, Sale } from '../../core/models/commerce.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CommerceService } from '../../core/services/commerce.service';
import { StatusPanel } from '../../shared/components/status-panel/status-panel';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';
import { AdminApiService, Entity } from './admin-api.service';

interface SaleLine {
  variant: ProductVariant;
  product: Product;
  quantity: number;
}

@Component({
  selector: 'app-pos-sales-admin',
  imports: [ReactiveFormsModule, BolivianosPipe],
  template: `
    <section>
      <header class="admin-page-heading">
        <div>
          <h1>Venta presencial</h1>
          <p>Registra una venta en efectivo con stock y costo FIFO reales.</p>
        </div>
      </header>
      @if (error()) {
        <p class="admin-notice admin-notice--error" role="alert">{{ error() }}</p>
      }
      @if (completed(); as sale) {
        <div class="admin-complete-state">
          <strong>Venta #{{ sale.id_venta }} registrada</strong>
          <p>Total {{ sale.total | bolivianos }}. El inventario fue actualizado.</p>
        </div>
      }
      <form class="pos-builder" [formGroup]="form" (ngSubmit)="addLine()">
        <label class="field"
          ><span>Sucursal</span
          ><select formControlName="branch">
            <option value="">Selecciona</option>
            @for (branch of branches(); track branch.id_sucursal) {
              <option [value]="branch.id_sucursal">{{ branch.nombre }}</option>
            }
          </select></label
        >
        <label class="field pos-search"
          ><span>Buscar producto o SKU</span
          ><input formControlName="search" (input)="search.set(form.controls.search.value)"
        /></label>
        <label class="field"
          ><span>Variante</span
          ><select formControlName="variant">
            <option value="">Selecciona</option>
            @for (entry of filteredVariants(); track entry.variant.id_variante) {
              <option [value]="entry.variant.id_variante">
                {{ entry.product.nombre }} / {{ entry.variant.color }} / {{ entry.variant.talla }} /
                {{ entry.variant.sku }}
              </option>
            }
          </select></label
        >
        <label class="field"
          ><span>Cantidad</span><input type="number" min="1" formControlName="quantity"
        /></label>
        <button
          class="button button--secondary"
          type="submit"
          [disabled]="form.controls.variant.invalid || form.controls.quantity.invalid"
        >
          Agregar a venta
        </button>
      </form>
      @if (lines().length) {
        <div class="admin-panel pos-ticket">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Variante</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (line of lines(); track line.variant.id_variante) {
                <tr>
                  <td>{{ line.product.nombre }}</td>
                  <td>{{ line.variant.color }} / {{ line.variant.talla }}</td>
                  <td>{{ line.quantity }}</td>
                  <td>{{ line.product.precio_actual | bolivianos }}</td>
                  <td>
                    <button
                      class="text-button"
                      type="button"
                      (click)="removeLine(line.variant.id_variante)"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <footer>
            <strong>Total estimado {{ estimatedTotal() | bolivianos }}</strong
            ><button
              class="button button--primary"
              type="button"
              [disabled]="saving() || !form.controls.branch.value"
              (click)="confirm()"
            >
              {{ saving() ? 'Registrando…' : 'Cobrar en efectivo' }}
            </button>
          </footer>
        </div>
      }
    </section>
  `,
})
export class PosSalesAdmin {
  private readonly fb = inject(FormBuilder);
  private readonly commerce = inject(CommerceService);
  private readonly catalog = inject(CatalogService);
  private readonly errors = inject(ApiErrorService);
  readonly branches = signal<Branch[]>([]);
  readonly products = signal<Product[]>([]);
  readonly lines = signal<SaleLine[]>([]);
  readonly search = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly completed = signal<Sale | null>(null);
  readonly form = this.fb.nonNullable.group({
    branch: ['', Validators.required],
    search: [''],
    variant: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
  });
  readonly filteredVariants = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.products().flatMap((product) =>
      product.variantes
        .filter(
          (variant) =>
            variant.activo &&
            (!term ||
              `${product.nombre} ${variant.sku} ${variant.color} ${variant.talla}`
                .toLowerCase()
                .includes(term)),
        )
        .map((variant) => ({ product, variant })),
    );
  });
  readonly estimatedTotal = computed(() =>
    this.lines().reduce(
      (total, item) => total + Number(item.product.precio_actual || 0) * item.quantity,
      0,
    ),
  );
  constructor() {
    forkJoin({
      branches: this.catalog.branches(),
      products: this.catalog.products({ page_size: 100, activo: true }),
    }).subscribe({
      next: (data) => {
        this.branches.set(data.branches);
        this.products.set(data.products.items);
      },
      error: (error) => this.error.set(this.errors.message(error, 'No pudimos preparar la venta.')),
    });
  }
  addLine(): void {
    const variantId = Number(this.form.controls.variant.value);
    const entry = this.filteredVariants().find((item) => item.variant.id_variante === variantId);
    if (!entry) return;
    const quantity = this.form.controls.quantity.value;
    this.lines.update((items) => {
      const current = items.find((item) => item.variant.id_variante === variantId);
      return current
        ? items.map((item) =>
            item === current ? { ...item, quantity: item.quantity + quantity } : item,
          )
        : [...items, { ...entry, quantity }];
    });
    this.form.controls.variant.reset('');
    this.form.controls.quantity.reset(1);
  }
  removeLine(id: number): void {
    this.lines.update((items) => items.filter((item) => item.variant.id_variante !== id));
  }
  confirm(): void {
    if (!this.lines().length || !this.form.controls.branch.value) return;
    this.saving.set(true);
    this.commerce
      .createPosSale({
        id_sucursal: Number(this.form.controls.branch.value),
        modalidad_entrega: 'ENTREGA_DIRECTA',
        registrar_efectivo: true,
        items: this.lines().map((item) => ({
          id_variante: item.variant.id_variante,
          cantidad: item.quantity,
        })),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (sale) => {
          this.completed.set(sale);
          this.lines.set([]);
        },
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos registrar la venta.')),
      });
  }
}

@Component({
  selector: 'app-reservations-admin',
  imports: [DatePipe, StatusPanel],
  template: `<section>
    <header class="admin-page-heading">
      <div>
        <h1>Reservas</h1>
        <p>Prepara prendas y actualiza su estado operativo.</p>
      </div>
    </header>
    @if (error()) {
      <p class="admin-notice admin-notice--error">{{ error() }}</p>
    }
    @if (loading()) {
      <div class="admin-skeleton-grid"><span></span><span></span></div>
    } @else if (!items().length) {
      <app-status-panel title="Sin reservas" message="No existen reservas para procesar." />
    } @else {
      <div class="admin-card-list">
        @for (item of items(); track item.id_reserva) {
          <article>
            <header>
              <div>
                <h2>Reserva #{{ item.id_reserva }}</h2>
                <p>
                  {{ item.sucursal }} /
                  {{ item.fecha_cita ? (item.fecha_cita | date: 'short') : 'Sin cita' }}
                </p>
              </div>
              <span class="status-chip">{{ item.estado }}</span>
            </header>
            <p>
              @for (line of item.items; track line.id_detalle) {
                {{ line.producto }} / {{ line.talla }} × {{ line.cantidad }}<br />
              }
            </p>
            <div class="record-actions">
              @for (state of nextReservationStates(item.estado); track state) {
                <button
                  class="button button--quiet"
                  type="button"
                  [disabled]="saving()"
                  (click)="update(item.id_reserva, state)"
                >
                  {{ stateLabel(state) }}
                </button>
              }
            </div>
          </article>
        }
      </div>
    }
  </section>`,
})
export class ReservationsAdmin {
  private readonly commerce = inject(CommerceService);
  private readonly errors = inject(ApiErrorService);
  readonly items = signal<Reservation[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  constructor() {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.commerce
      .adminReservations()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (items) => this.items.set(items),
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos cargar las reservas.')),
      });
  }
  nextReservationStates(state: string): string[] {
    return (
      (
        {
          PENDIENTE: ['CONFIRMADA', 'CANCELADA'],
          CONFIRMADA: ['PREPARANDO', 'CANCELADA'],
          PREPARANDO: ['LISTA', 'CANCELADA'],
          LISTA: ['CLIENTE_PRESENTE', 'CANCELADA'],
          CLIENTE_PRESENTE: ['CONVERTIDA', 'CANCELADA'],
        } as Record<string, string[]>
      )[state] ?? []
    );
  }
  stateLabel(state: string): string {
    return state.toLowerCase().replaceAll('_', ' ');
  }
  update(id: number, state: string): void {
    this.saving.set(true);
    this.commerce
      .updateReservation(id, state)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) =>
          this.items.update((items) =>
            items.map((item) => (item.id_reserva === id ? updated : item)),
          ),
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos actualizar la reserva.')),
      });
  }
}

@Component({
  selector: 'app-orders-admin',
  imports: [DatePipe, BolivianosPipe, StatusPanel],
  template: `<section>
    <header class="admin-page-heading">
      <div>
        <h1>Pedidos</h1>
        <p>Gestiona preparación, retiro y delivery según modalidad.</p>
      </div>
    </header>
    @if (error()) {
      <p class="admin-notice admin-notice--error">{{ error() }}</p>
    }
    @if (loading()) {
      <div class="admin-skeleton-grid"><span></span></div>
    } @else if (!items().length) {
      <app-status-panel title="Sin pedidos" message="Los pedidos web aparecerán aquí." />
    } @else {
      <div class="admin-card-list">
        @for (item of items(); track item.id_pedido) {
          <article>
            <header>
              <div>
                <h2>Pedido #{{ item.id_pedido }}</h2>
                <p>{{ item.sucursal }} / {{ item.fecha_creacion | date: 'short' }}</p>
              </div>
              <span class="status-chip">{{ item.estado }}</span>
            </header>
            <p>
              {{
                item.modalidad_entrega === 'DELIVERY'
                  ? item.direccion_entrega
                  : 'Retiro en ' + item.direccion_sucursal
              }}
            </p>
            <strong>{{ item.total | bolivianos }}</strong>
            <div class="record-actions">
              @for (state of nextOrderStates(item); track state) {
                <button
                  class="button button--quiet"
                  type="button"
                  [disabled]="saving()"
                  (click)="update(item.id_pedido, state)"
                >
                  {{ stateLabel(state) }}
                </button>
              }
            </div>
          </article>
        }
      </div>
    }
  </section>`,
})
export class OrdersAdmin {
  private readonly commerce = inject(CommerceService);
  private readonly errors = inject(ApiErrorService);
  readonly items = signal<Order[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  constructor() {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.commerce
      .adminOrders()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (items) => this.items.set(items),
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos cargar los pedidos.')),
      });
  }
  nextOrderStates(item: Order): string[] {
    const choices = {
      PENDIENTE: ['PREPARANDO', 'CANCELADO'],
      PREPARANDO:
        item.modalidad_entrega === 'DELIVERY'
          ? ['LISTO_PARA_ENVIO', 'CANCELADO']
          : ['LISTO_PARA_RETIRO', 'CANCELADO'],
      LISTO_PARA_RETIRO: ['RETIRADO', 'CANCELADO'],
      LISTO_PARA_ENVIO: ['RECOGIDO', 'EN_CAMINO', 'CANCELADO'],
      RECOGIDO: ['EN_CAMINO', 'ENTREGADO'],
      EN_CAMINO: ['ENTREGADO'],
    } as Record<string, string[]>;
    return choices[item.estado] ?? [];
  }
  stateLabel(state: string): string {
    return state.toLowerCase().replaceAll('_', ' ');
  }
  update(id: number, state: string): void {
    this.saving.set(true);
    this.commerce
      .updateOrder(id, state)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) =>
          this.items.update((items) =>
            items.map((item) => (item.id_pedido === id ? updated : item)),
          ),
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos actualizar el pedido.')),
      });
  }
}

@Component({
  selector: 'app-returns-admin',
  imports: [DatePipe, StatusPanel],
  template: `<section>
    <header class="admin-page-heading">
      <div>
        <h1>Devoluciones</h1>
        <p>Revisa solicitudes y reintegra stock apto al completar.</p>
      </div>
    </header>
    @if (error()) {
      <p class="admin-notice admin-notice--error">{{ error() }}</p>
    }
    @if (loading()) {
      <div class="admin-skeleton-grid"><span></span></div>
    } @else if (!items().length) {
      <app-status-panel title="Sin devoluciones" message="No existen solicitudes pendientes." />
    } @else {
      <div class="admin-card-list">
        @for (item of items(); track item.id_devolucion) {
          <article>
            <header>
              <div>
                <h2>Devolución #{{ item.id_devolucion }}</h2>
                <p>Venta #{{ item.id_venta }} / {{ item.fecha_solicitud | date: 'short' }}</p>
              </div>
              <span class="status-chip">{{ item.estado }}</span>
            </header>
            <p>{{ item.motivo }}</p>
            <div class="record-actions">
              @for (state of nextStates(item.estado); track state) {
                <button
                  class="button button--quiet"
                  type="button"
                  [disabled]="saving()"
                  (click)="update(item.id_devolucion, state)"
                >
                  {{ state.toLowerCase() }}
                </button>
              }
            </div>
          </article>
        }
      </div>
    }
  </section>`,
})
export class ReturnsAdmin {
  private readonly commerce = inject(CommerceService);
  private readonly errors = inject(ApiErrorService);
  readonly items = signal<ReturnRequest[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  constructor() {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.commerce
      .adminReturns()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (items) => this.items.set(items),
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos cargar las devoluciones.')),
      });
  }
  nextStates(state: string): string[] {
    return (
      (
        { PENDIENTE: ['APROBADA', 'RECHAZADA'], APROBADA: ['COMPLETADA', 'RECHAZADA'] } as Record<
          string,
          string[]
        >
      )[state] ?? []
    );
  }
  update(id: number, state: string): void {
    this.saving.set(true);
    this.commerce
      .updateReturn(id, state)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) =>
          this.items.update((items) =>
            items.map((item) => (item.id_devolucion === id ? updated : item)),
          ),
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos actualizar la devolución.')),
      });
  }
}

@Component({
  selector: 'app-supplier-history-admin',
  imports: [ReactiveFormsModule, DatePipe, BolivianosPipe, StatusPanel],
  template: `<section>
    <header class="admin-page-heading">
      <div>
        <h1>Compras a proveedores</h1>
        <p>Costos históricos por recepción y lote, sin recalcular precios pasados.</p>
      </div>
      <strong>{{ total() }} registros</strong>
    </header>
    <form class="admin-filterbar supplier-history-filters" [formGroup]="form" (ngSubmit)="load(1)">
      <label class="field"
        ><span>Proveedor</span
        ><select formControlName="proveedor">
          <option value="">Todos</option>
          @for (supplier of suppliers(); track supplier['id_proveedor']) {
            <option [value]="supplier['id_proveedor']">{{ supplier['razon_social'] }}</option>
          }
        </select></label
      ><label class="field"
        ><span>Sucursal</span
        ><select formControlName="sucursal">
          <option value="">Todas</option>
          @for (branch of branches(); track branch.id_sucursal) {
            <option [value]="branch.id_sucursal">{{ branch.nombre }}</option>
          }
        </select></label
      ><label class="field"
        ><span>Desde</span><input type="date" formControlName="fecha_desde" /></label
      ><label class="field"
        ><span>Hasta</span><input type="date" formControlName="fecha_hasta" /></label
      ><button class="button button--primary" type="submit">Filtrar</button>
    </form>
    @if (error()) {
      <p class="admin-notice admin-notice--error">{{ error() }}</p>
    }
    @if (loading()) {
      <div class="admin-skeleton-table"><span></span><span></span></div>
    } @else if (!items().length) {
      <app-status-panel title="Sin compras" message="No existen recepciones para estos filtros." />
    } @else {
      <div class="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Orden / recepción</th>
              <th>Producto</th>
              <th>Variante</th>
              <th>Cantidad</th>
              <th>Costo</th>
              <th>Subtotal</th>
              <th>Total recepción</th>
              <th>Sucursal</th>
              <th>Responsable</th>
            </tr>
          </thead>
          <tbody>
            @for (item of items(); track item['id_recepcion'] + '-' + item['id_variante']) {
              <tr>
                <td>{{ item['fecha_recepcion'] | date: 'short' }}</td>
                <td>{{ item['proveedor'] || 'Sin proveedor' }}</td>
                <td>#{{ item['id_orden_compra'] || 'N/D' }} / #{{ item['id_recepcion'] }}</td>
                <td>{{ item['producto'] }}</td>
                <td>{{ item['color'] }} / {{ item['talla'] }}</td>
                <td>{{ item['cantidad'] }}</td>
                <td>{{ item['precio_unitario'] | bolivianos }}</td>
                <td>{{ item['subtotal'] | bolivianos }}</td>
                <td>{{ item['total_compra'] | bolivianos }}</td>
                <td>{{ item['sucursal'] }}</td>
                <td>{{ item['usuario_responsable'] || 'No disponible' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <nav class="audit-pagination" aria-label="Paginación">
        <button
          class="button button--quiet"
          type="button"
          [disabled]="page() === 1"
          (click)="load(page() - 1)"
        >
          Anterior</button
        ><span>Página {{ page() }}</span
        ><button
          class="button button--quiet"
          type="button"
          [disabled]="page() * 25 >= total()"
          (click)="load(page() + 1)"
        >
          Siguiente
        </button>
      </nav>
    }
  </section>`,
})
export class SupplierHistoryAdmin {
  private readonly fb = inject(FormBuilder);
  private readonly commerce = inject(CommerceService);
  private readonly catalog = inject(CatalogService);
  private readonly admin = inject(AdminApiService);
  private readonly errors = inject(ApiErrorService);
  readonly suppliers = signal<Entity[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly items = signal<Array<Record<string, string | number | null>>>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    proveedor: [''],
    sucursal: [''],
    fecha_desde: [''],
    fecha_hasta: [''],
  });
  constructor() {
    forkJoin({
      suppliers: this.admin.list('suppliers'),
      branches: this.catalog.branches(),
    }).subscribe({
      next: (data) => {
        this.suppliers.set(data.suppliers);
        this.branches.set(data.branches);
        this.load();
      },
      error: (error) =>
        this.error.set(this.errors.message(error, 'No pudimos cargar los filtros.')),
    });
  }
  load(page = 1): void {
    this.loading.set(true);
    const value = this.form.getRawValue();
    this.commerce
      .supplierPurchaseHistory({ page, page_size: 25, ...value })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.items.set(result.items);
          this.total.set(result.total);
          this.page.set(result.page);
        },
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos cargar el historial.')),
      });
  }
}
