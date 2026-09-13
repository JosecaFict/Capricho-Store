import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { Branch, Product, ProductVariant } from '../../core/models/catalog.model';
import { Order, Reservation, ReturnRequest, Sale } from '../../core/models/commerce.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CommerceService } from '../../core/services/commerce.service';
import { StatusPanel } from '../../shared/components/status-panel/status-panel';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';
import { formatBranchName } from '../commerce/commerce-pages';
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

type ReservationTab =
  | 'TODOS'
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'PREPARANDO'
  | 'LISTA'
  | 'CLIENTE_PRESENTE'
  | 'CONVERTIDA'
  | 'CANCELADA';

@Component({
  selector: 'app-reservations-admin',
  imports: [DatePipe, BolivianosPipe, StatusPanel, FormsModule],
  template: `
    <section class="orders-admin-surface">
      <header class="admin-page-heading">
        <div>
          <h1>Gestión de Reservas</h1>
          <p>Supervisa citas en sucursal, apartado de prendas en probador y conversión a ventas.</p>
        </div>
      </header>

      @if (error()) {
        <p class="admin-notice admin-notice--error">{{ error() }}</p>
      }

      <!-- Barra de pestañas por etapa de reserva -->
      <nav class="orders-tabs" aria-label="Etapas de reservas">
        <button
          type="button"
          class="orders-tab"
          [class.is-active]="activeTab() === 'TODOS'"
          (click)="activeTab.set('TODOS')"
        >
          Todas
          <span class="orders-tab-badge">{{ counts().TODOS }}</span>
        </button>
        <button
          type="button"
          class="orders-tab"
          [class.is-active]="activeTab() === 'PENDIENTE'"
          (click)="activeTab.set('PENDIENTE')"
        >
          Por confirmar
          <span class="orders-tab-badge orders-tab-badge--pending">{{ counts().PENDIENTE }}</span>
        </button>
        <button
          type="button"
          class="orders-tab"
          [class.is-active]="activeTab() === 'CONFIRMADA'"
          (click)="activeTab.set('CONFIRMADA')"
        >
          Confirmadas
          <span class="orders-tab-badge orders-tab-badge--ready">{{ counts().CONFIRMADA }}</span>
        </button>
        <button
          type="button"
          class="orders-tab"
          [class.is-active]="activeTab() === 'PREPARANDO'"
          (click)="activeTab.set('PREPARANDO')"
        >
          Apartando
          <span class="orders-tab-badge orders-tab-badge--preparing">{{ counts().PREPARANDO }}</span>
        </button>
        <button
          type="button"
          class="orders-tab"
          [class.is-active]="activeTab() === 'LISTA'"
          (click)="activeTab.set('LISTA')"
        >
          En probador
          <span class="orders-tab-badge orders-tab-badge--completed">{{ counts().LISTA }}</span>
        </button>
        <button
          type="button"
          class="orders-tab"
          [class.is-active]="activeTab() === 'CLIENTE_PRESENTE'"
          (click)="activeTab.set('CLIENTE_PRESENTE')"
        >
          Cliente en tienda
          <span class="orders-tab-badge orders-tab-badge--ready">{{ counts().CLIENTE_PRESENTE }}</span>
        </button>
        <button
          type="button"
          class="orders-tab"
          [class.is-active]="activeTab() === 'CONVERTIDA'"
          (click)="activeTab.set('CONVERTIDA')"
        >
          Concretadas
          <span class="orders-tab-badge orders-tab-badge--completed">{{ counts().CONVERTIDA }}</span>
        </button>
        <button
          type="button"
          class="orders-tab"
          [class.is-active]="activeTab() === 'CANCELADA'"
          (click)="activeTab.set('CANCELADA')"
        >
          Canceladas
          <span class="orders-tab-badge">{{ counts().CANCELADA }}</span>
        </button>
      </nav>

      <!-- Barra de filtros y búsqueda -->
      <div class="orders-filterbar">
        <div class="orders-filter-field">
          <label for="reservation-search">Buscar reserva o prenda</label>
          <input
            id="reservation-search"
            type="search"
            placeholder="Ej: #1, Ralph Lauren, S, Central..."
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
          />
        </div>
        <div class="orders-filter-field">
          <label for="reservation-branch">Sucursal</label>
          <select
            id="reservation-branch"
            [ngModel]="selectedBranch()"
            (ngModelChange)="selectedBranch.set($event)"
          >
            <option value="">Todas las sucursales</option>
            @for (b of branches(); track b.id_sucursal) {
              <option [value]="b.id_sucursal">{{ b.nombre }}</option>
            }
          </select>
        </div>
        <div class="orders-filter-field">
          <label for="reservation-date-filter">Horario de visita</label>
          <select
            id="reservation-date-filter"
            [ngModel]="selectedDateFilter()"
            (ngModelChange)="selectedDateFilter.set($event)"
          >
            <option value="TODAS">Todas las fechas</option>
            <option value="HOY">Citas de HOY</option>
            <option value="PROXIMAS">Próximas citas</option>
            <option value="SIN_CITA">Sin horario específico</option>
          </select>
        </div>
        <button
          type="button"
          class="orders-refresh-btn"
          [disabled]="loading() || saving()"
          (click)="load()"
          title="Actualizar reservas"
        >
          ↻ Actualizar
        </button>
      </div>

      <!-- Contenido de la tabla -->
      @if (loading()) {
        <div class="admin-skeleton-grid"><span></span></div>
      } @else if (!filteredItems().length) {
        <app-status-panel
          title="Sin reservas encontradas"
          message="No hay reservas que coincidan con los filtros o la pestaña seleccionada."
        />
      } @else {
        <div class="admin-table-wrap">
          <table class="orders-table">
            <thead>
              <tr>
                <th>Reserva</th>
                <th>Cita / Visita</th>
                <th>Sucursal</th>
                <th>Prendas Apartadas</th>
                <th>Total Estimado</th>
                <th>Estado</th>
                <th style="text-align: right;">Acción Siguiente</th>
              </tr>
            </thead>
            <tbody>
              @for (item of filteredItems(); track item.id_reserva) {
                <tr>
                  <!-- Reserva & Creación -->
                  <td>
                    <div class="order-id-cell">
                      <span class="order-id-title">Reserva #{{ item.id_reserva }}</span>
                      <span class="order-date-text">{{ item.fecha_reserva | date: 'short' }}</span>
                    </div>
                  </td>

                  <!-- Cita / Visita -->
                  <td>
                    @if (isToday(item.fecha_cita)) {
                      <span class="order-mode-pill order-mode-pill--appointment-today">
                        🔥 CITA HOY
                      </span>
                      <strong class="order-location-text" style="color: #b45309; font-size: 0.85rem;">
                        {{ item.fecha_cita | date: 'HH:mm' }}
                      </strong>
                    } @else if (item.fecha_cita) {
                      <span class="order-mode-pill order-mode-pill--appointment">
                        📅 Visita programada
                      </span>
                      <small class="order-location-text">
                        {{ item.fecha_cita | date: 'dd/MM/yyyy HH:mm' }}
                      </small>
                    } @else {
                      <span class="order-mode-pill" style="background: var(--surface-muted); color: var(--ink-soft);">
                        Sin horario
                      </span>
                    }
                  </td>

                  <!-- Sucursal -->
                  <td>
                    <div class="order-id-cell">
                      <span class="orders-item-name" style="font-weight: 700;">
                        {{ formatBranchName(item.sucursal, item.id_sucursal) }}
                      </span>
                      @if (item.direccion_sucursal) {
                        <small class="order-location-text">{{ item.direccion_sucursal }}</small>
                      }
                    </div>
                  </td>

                  <!-- Prendas apartadas -->
                  <td>
                    <div class="orders-items-list">
                      @for (line of item.items; track line.id_detalle) {
                        <div class="orders-item-line">
                          @if (line.imagen_url) {
                            <img [src]="line.imagen_url" [alt]="line.producto" class="orders-item-thumb" />
                          } @else {
                            <span class="orders-item-thumb orders-item-thumb--placeholder">👕</span>
                          }
                          <div class="orders-item-info">
                            <span class="orders-item-name" [title]="line.producto">{{ line.producto }}</span>
                            <small class="orders-item-meta">
                              {{ line.color }} · Talla {{ line.talla }} <strong>×{{ line.cantidad }}</strong>
                            </small>
                          </div>
                        </div>
                      }
                    </div>
                  </td>

                  <!-- Total estimado -->
                  <td>
                    <div class="orders-price-cell">
                      <span class="orders-total-amount">{{ totalEstimated(item) | bolivianos }}</span>
                      <small style="color: var(--ink-soft); font-size: 0.72rem;">Pago en tienda</small>
                    </div>
                  </td>

                  <!-- Estado actual -->
                  <td>
                    <span class="order-badge" [class]="statusBadgeClass(item.estado)">
                      {{ statusLabel(item.estado) }}
                    </span>
                  </td>

                  <!-- Acción operativa -->
                  <td style="text-align: right;">
                    <div class="orders-action-cell" style="align-items: flex-end;">
                      @if (primaryAction(item); as act) {
                        <button
                          class="order-primary-btn"
                          type="button"
                          [disabled]="saving()"
                          (click)="update(item.id_reserva, act.targetState)"
                        >
                          {{ act.label }}
                        </button>
                      }
                      @if (canCancel(item)) {
                        <button
                          class="order-cancel-btn"
                          type="button"
                          [disabled]="saving()"
                          (click)="confirmCancel(item)"
                        >
                          Cancelar reserva
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class ReservationsAdmin {
  private readonly commerce = inject(CommerceService);
  private readonly catalog = inject(CatalogService);
  private readonly errors = inject(ApiErrorService);

  readonly items = signal<Reservation[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly activeTab = signal<ReservationTab>('TODOS');
  readonly searchTerm = signal<string>('');
  readonly selectedBranch = signal<string>('');
  readonly selectedDateFilter = signal<'TODAS' | 'HOY' | 'PROXIMAS' | 'SIN_CITA'>('TODAS');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formatBranchName = formatBranchName;

  readonly counts = computed(() => {
    const all = this.items();
    return {
      TODOS: all.length,
      PENDIENTE: all.filter((r) => r.estado === 'PENDIENTE').length,
      CONFIRMADA: all.filter((r) => r.estado === 'CONFIRMADA').length,
      PREPARANDO: all.filter((r) => r.estado === 'PREPARANDO').length,
      LISTA: all.filter((r) => r.estado === 'LISTA').length,
      CLIENTE_PRESENTE: all.filter((r) => r.estado === 'CLIENTE_PRESENTE').length,
      CONVERTIDA: all.filter((r) => r.estado === 'CONVERTIDA').length,
      CANCELADA: all.filter((r) => r.estado === 'CANCELADA' || r.estado === 'EXPIRADA').length,
    };
  });

  readonly filteredItems = computed(() => {
    let result = this.items();
    const tab = this.activeTab();
    if (tab === 'PENDIENTE') {
      result = result.filter((r) => r.estado === 'PENDIENTE');
    } else if (tab === 'CONFIRMADA') {
      result = result.filter((r) => r.estado === 'CONFIRMADA');
    } else if (tab === 'PREPARANDO') {
      result = result.filter((r) => r.estado === 'PREPARANDO');
    } else if (tab === 'LISTA') {
      result = result.filter((r) => r.estado === 'LISTA');
    } else if (tab === 'CLIENTE_PRESENTE') {
      result = result.filter((r) => r.estado === 'CLIENTE_PRESENTE');
    } else if (tab === 'CONVERTIDA') {
      result = result.filter((r) => r.estado === 'CONVERTIDA');
    } else if (tab === 'CANCELADA') {
      result = result.filter((r) => r.estado === 'CANCELADA' || r.estado === 'EXPIRADA');
    }

    const branch = this.selectedBranch();
    if (branch) {
      result = result.filter((r) => r.id_sucursal === Number(branch));
    }

    const dateFilter = this.selectedDateFilter();
    if (dateFilter === 'HOY') {
      result = result.filter((r) => this.isToday(r.fecha_cita));
    } else if (dateFilter === 'PROXIMAS') {
      const now = new Date();
      result = result.filter((r) => r.fecha_cita && new Date(r.fecha_cita) >= now);
    } else if (dateFilter === 'SIN_CITA') {
      result = result.filter((r) => !r.fecha_cita);
    }

    const search = this.searchTerm().trim().toLowerCase();
    if (search) {
      result = result.filter((r) => {
        const idMatch = String(r.id_reserva).includes(search) || `#${r.id_reserva}`.includes(search);
        const branchMatch = r.sucursal.toLowerCase().includes(search);
        const itemsMatch = r.items.some(
          (i) =>
            i.producto.toLowerCase().includes(search) ||
            i.color.toLowerCase().includes(search) ||
            i.talla.toLowerCase().includes(search) ||
            i.sku.toLowerCase().includes(search),
        );
        const addressMatch = (r.direccion_sucursal || '').toLowerCase().includes(search);
        return idMatch || branchMatch || itemsMatch || addressMatch;
      });
    }

    return result;
  });

  constructor() {
    this.load();
    this.catalog.branches().subscribe({
      next: (branches) => this.branches.set(branches),
      error: () => {},
    });
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

  primaryAction(item: Reservation): { targetState: string; label: string } | null {
    switch (item.estado) {
      case 'PENDIENTE':
        return { targetState: 'CONFIRMADA', label: 'Confirmar cita ✓' };
      case 'CONFIRMADA':
        return { targetState: 'PREPARANDO', label: 'Apartar prendas 👕' };
      case 'PREPARANDO':
        return { targetState: 'LISTA', label: 'Lista en probador 🛍️' };
      case 'LISTA':
        return { targetState: 'CLIENTE_PRESENTE', label: 'Cliente en tienda 👤' };
      case 'CLIENTE_PRESENTE':
        return { targetState: 'CONVERTIDA', label: 'Concretar venta 💳' };
      default:
        return null;
    }
  }

  canCancel(item: Reservation): boolean {
    return ['PENDIENTE', 'CONFIRMADA', 'PREPARANDO', 'LISTA', 'CLIENTE_PRESENTE'].includes(
      item.estado,
    );
  }

  confirmCancel(item: Reservation): void {
    if (
      confirm(
        `¿Estás seguro de cancelar la Reserva #${item.id_reserva}? Las prendas reservadas volverán al stock disponible.`,
      )
    ) {
      this.update(item.id_reserva, 'CANCELADA');
    }
  }

  totalEstimated(item: Reservation): number {
    return item.items.reduce((acc, line) => acc + Number(line.subtotal || 0), 0);
  }

  isToday(dateStr: string | null): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  }

  statusLabel(state: string): string {
    switch (state) {
      case 'PENDIENTE':
        return 'Por confirmar';
      case 'CONFIRMADA':
        return 'Confirmada';
      case 'PREPARANDO':
        return 'Apartando';
      case 'LISTA':
        return 'Lista en probador';
      case 'CLIENTE_PRESENTE':
        return 'Cliente en tienda';
      case 'CONVERTIDA':
        return 'Venta concretada';
      case 'CANCELADA':
        return 'Cancelada';
      case 'EXPIRADA':
        return 'Expirada';
      default:
        return state;
    }
  }

  statusBadgeClass(state: string): string {
    switch (state) {
      case 'PENDIENTE':
        return 'order-badge--pending';
      case 'CONFIRMADA':
        return 'order-badge--ready';
      case 'PREPARANDO':
        return 'order-badge--preparing';
      case 'LISTA':
        return 'order-badge--completed';
      case 'CLIENTE_PRESENTE':
        return 'order-badge--ready';
      case 'CONVERTIDA':
        return 'order-badge--completed';
      case 'CANCELADA':
      case 'EXPIRADA':
        return 'order-badge--cancelled';
      default:
        return 'order-badge--default';
    }
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

type OrderTab = 'TODOS' | 'PENDIENTE' | 'PREPARANDO' | 'LISTO' | 'COMPLETADO' | 'CANCELADO';

@Component({
  selector: 'app-orders-admin',
  imports: [DatePipe, BolivianosPipe, StatusPanel, FormsModule],
  template: `
    <section class="orders-admin-surface">
      <header class="admin-page-heading">
        <div>
          <h1>Gestión de Pedidos</h1>
          <p>Controla el pipeline de despacho: preparación, entrega en tienda y envíos delivery.</p>
        </div>
      </header>

      @if (error()) {
        <p class="admin-notice admin-notice--error">{{ error() }}</p>
      }

      <!-- Barra de pestañas por etapa -->
      <nav class="orders-tabs" aria-label="Etapas de pedidos">
        <button
          type="button"
          class="orders-tab"
          [class.is-active]="activeTab() === 'TODOS'"
          (click)="activeTab.set('TODOS')"
        >
          Todos
          <span class="orders-tab-badge">{{ counts().TODOS }}</span>
        </button>
        <button
          type="button"
          class="orders-tab"
          [class.is-active]="activeTab() === 'PENDIENTE'"
          (click)="activeTab.set('PENDIENTE')"
        >
          Por preparar
          <span class="orders-tab-badge orders-tab-badge--pending">{{ counts().PENDIENTE }}</span>
        </button>
        <button
          type="button"
          class="orders-tab"
          [class.is-active]="activeTab() === 'PREPARANDO'"
          (click)="activeTab.set('PREPARANDO')"
        >
          En preparación
          <span class="orders-tab-badge orders-tab-badge--preparing">{{ counts().PREPARANDO }}</span>
        </button>
        <button
          type="button"
          class="orders-tab"
          [class.is-active]="activeTab() === 'LISTO'"
          (click)="activeTab.set('LISTO')"
        >
          Listos para entrega
          <span class="orders-tab-badge orders-tab-badge--ready">{{ counts().LISTO }}</span>
        </button>
        <button
          type="button"
          class="orders-tab"
          [class.is-active]="activeTab() === 'COMPLETADO'"
          (click)="activeTab.set('COMPLETADO')"
        >
          Completados
          <span class="orders-tab-badge orders-tab-badge--completed">{{ counts().COMPLETADO }}</span>
        </button>
        <button
          type="button"
          class="orders-tab"
          [class.is-active]="activeTab() === 'CANCELADO'"
          (click)="activeTab.set('CANCELADO')"
        >
          Cancelados
          <span class="orders-tab-badge">{{ counts().CANCELADO }}</span>
        </button>
      </nav>

      <!-- Barra de filtros y búsqueda -->
      <div class="orders-filterbar">
        <div class="orders-filter-field">
          <label for="order-search">Buscar pedido o prenda</label>
          <input
            id="order-search"
            type="search"
            placeholder="Ej: #12, Polo, Verde, Central..."
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
          />
        </div>
        <div class="orders-filter-field">
          <label for="order-branch">Sucursal</label>
          <select
            id="order-branch"
            [ngModel]="selectedBranch()"
            (ngModelChange)="selectedBranch.set($event)"
          >
            <option value="">Todas las sucursales</option>
            @for (b of branches(); track b.id_sucursal) {
              <option [value]="b.id_sucursal">{{ b.nombre }}</option>
            }
          </select>
        </div>
        <div class="orders-filter-field">
          <label for="order-mode">Modalidad</label>
          <select
            id="order-mode"
            [ngModel]="selectedMode()"
            (ngModelChange)="selectedMode.set($event)"
          >
            <option value="">Todas las modalidades</option>
            <option value="RETIRO_SUCURSAL">Retiro en tienda</option>
            <option value="DELIVERY">Delivery a domicilio</option>
          </select>
        </div>
        <button
          type="button"
          class="orders-refresh-btn"
          [disabled]="loading() || saving()"
          (click)="load()"
          title="Actualizar pedidos"
        >
          ↻ Actualizar
        </button>
      </div>

      <!-- Contenido de la tabla -->
      @if (loading()) {
        <div class="admin-skeleton-grid"><span></span></div>
      } @else if (!filteredItems().length) {
        <app-status-panel
          title="Sin pedidos encontrados"
          message="No hay pedidos que coincidan con el filtro o la pestaña seleccionada."
        />
      } @else {
        <div class="admin-table-wrap">
          <table class="orders-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Modalidad & Destino</th>
                <th>Prendas a Entregar</th>
                <th>Total & Pago</th>
                <th>Estado</th>
                <th style="text-align: right;">Acción Siguiente</th>
              </tr>
            </thead>
            <tbody>
              @for (item of filteredItems(); track item.id_pedido) {
                <tr>
                  <!-- Pedido & Fecha -->
                  <td>
                    <div class="order-id-cell">
                      <span class="order-id-title">Pedido #{{ item.id_pedido }}</span>
                      <span class="order-date-text">{{ item.fecha_creacion | date: 'short' }}</span>
                    </div>
                  </td>

                  <!-- Modalidad & Destino -->
                  <td>
                    @if (item.modalidad_entrega === 'DELIVERY') {
                      <span class="order-mode-pill order-mode-pill--delivery">
                        🚚 Delivery
                      </span>
                      <small class="order-location-text">
                        {{ item.direccion_entrega || 'Dirección del cliente' }}
                      </small>
                    } @else {
                      <span class="order-mode-pill order-mode-pill--pickup">
                        🏬 Retiro en tienda
                      </span>
                      <small class="order-location-text">
                        {{ item.sucursal }} · {{ item.direccion_sucursal }}
                      </small>
                    }
                  </td>

                  <!-- Prendas a entregar -->
                  <td>
                    <div class="orders-items-list">
                      @for (line of item.items; track line.id_detalle) {
                        <div class="orders-item-line">
                          @if (line.imagen_url) {
                            <img [src]="line.imagen_url" [alt]="line.producto" class="orders-item-thumb" />
                          } @else {
                            <span class="orders-item-thumb orders-item-thumb--placeholder">👕</span>
                          }
                          <div class="orders-item-info">
                            <span class="orders-item-name" [title]="line.producto">{{ line.producto }}</span>
                            <small class="orders-item-meta">
                              {{ line.color }} · Talla {{ line.talla }} <strong>×{{ line.cantidad }}</strong>
                            </small>
                          </div>
                        </div>
                      }
                    </div>
                  </td>

                  <!-- Total y comprobante -->
                  <td>
                    <div class="orders-price-cell">
                      <span class="orders-total-amount">{{ item.total | bolivianos }}</span>
                      @if (item.receipt_url) {
                        <a
                          [href]="item.receipt_url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="orders-receipt-link"
                        >
                          Recibo Stripe ↗
                        </a>
                      } @else {
                        <span class="orders-paid-chip">✓ Pagado</span>
                      }
                    </div>
                  </td>

                  <!-- Estado actual -->
                  <td>
                    <span class="order-badge" [class]="statusBadgeClass(item.estado)">
                      {{ statusLabel(item.estado) }}
                    </span>
                  </td>

                  <!-- Acción principal y secundaria -->
                  <td style="text-align: right;">
                    <div class="orders-action-cell" style="align-items: flex-end;">
                      @if (primaryAction(item); as act) {
                        <button
                          class="order-primary-btn"
                          type="button"
                          [disabled]="saving()"
                          (click)="update(item.id_pedido, act.targetState)"
                        >
                          {{ act.label }}
                        </button>
                      }
                      @if (canCancel(item)) {
                        <button
                          class="order-cancel-btn"
                          type="button"
                          [disabled]="saving()"
                          (click)="confirmCancel(item)"
                        >
                          Cancelar pedido
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class OrdersAdmin {
  private readonly commerce = inject(CommerceService);
  private readonly catalog = inject(CatalogService);
  private readonly errors = inject(ApiErrorService);

  readonly items = signal<Order[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly activeTab = signal<OrderTab>('TODOS');
  readonly searchTerm = signal<string>('');
  readonly selectedBranch = signal<string>('');
  readonly selectedMode = signal<string>('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly counts = computed(() => {
    const all = this.items();
    return {
      TODOS: all.length,
      PENDIENTE: all.filter((o) => o.estado === 'PENDIENTE').length,
      PREPARANDO: all.filter((o) => o.estado === 'PREPARANDO').length,
      LISTO: all.filter(
        (o) => o.estado === 'LISTO_PARA_RETIRO' || o.estado === 'LISTO_PARA_ENVIO',
      ).length,
      COMPLETADO: all.filter((o) => o.estado === 'RETIRADO' || o.estado === 'ENTREGADO').length,
      CANCELADO: all.filter((o) => o.estado === 'CANCELADO').length,
    };
  });

  readonly filteredItems = computed(() => {
    let result = this.items();
    const tab = this.activeTab();
    if (tab === 'PENDIENTE') {
      result = result.filter((o) => o.estado === 'PENDIENTE');
    } else if (tab === 'PREPARANDO') {
      result = result.filter((o) => o.estado === 'PREPARANDO');
    } else if (tab === 'LISTO') {
      result = result.filter(
        (o) => o.estado === 'LISTO_PARA_RETIRO' || o.estado === 'LISTO_PARA_ENVIO',
      );
    } else if (tab === 'COMPLETADO') {
      result = result.filter((o) => o.estado === 'RETIRADO' || o.estado === 'ENTREGADO');
    } else if (tab === 'CANCELADO') {
      result = result.filter((o) => o.estado === 'CANCELADO');
    }

    const branch = this.selectedBranch();
    if (branch) {
      result = result.filter((o) => o.id_sucursal === Number(branch));
    }

    const mode = this.selectedMode();
    if (mode) {
      result = result.filter((o) => o.modalidad_entrega === mode);
    }

    const search = this.searchTerm().trim().toLowerCase();
    if (search) {
      result = result.filter((o) => {
        const idMatch = String(o.id_pedido).includes(search) || `#${o.id_pedido}`.includes(search);
        const branchMatch = o.sucursal.toLowerCase().includes(search);
        const itemsMatch = o.items.some(
          (i) =>
            i.producto.toLowerCase().includes(search) ||
            i.color.toLowerCase().includes(search) ||
            i.sku.toLowerCase().includes(search),
        );
        const addressMatch = (o.direccion_entrega || o.direccion_sucursal || '')
          .toLowerCase()
          .includes(search);
        return idMatch || branchMatch || itemsMatch || addressMatch;
      });
    }

    return result;
  });

  constructor() {
    this.load();
    this.catalog.branches().subscribe({
      next: (branches) => this.branches.set(branches),
      error: () => {},
    });
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

  primaryAction(item: Order): { targetState: string; label: string } | null {
    switch (item.estado) {
      case 'PENDIENTE':
        return { targetState: 'PREPARANDO', label: 'Comenzar preparación' };
      case 'PREPARANDO':
        return item.modalidad_entrega === 'DELIVERY'
          ? { targetState: 'LISTO_PARA_ENVIO', label: 'Listo para envío' }
          : { targetState: 'LISTO_PARA_RETIRO', label: 'Listo para retiro' };
      case 'LISTO_PARA_RETIRO':
        return { targetState: 'RETIRADO', label: 'Entregar (Retirado) ✓' };
      case 'LISTO_PARA_ENVIO':
        return { targetState: 'EN_CAMINO', label: 'Despachar (En camino)' };
      case 'RECOGIDO':
        return { targetState: 'EN_CAMINO', label: 'En camino' };
      case 'EN_CAMINO':
        return { targetState: 'ENTREGADO', label: 'Confirmar entrega ✓' };
      default:
        return null;
    }
  }

  canCancel(item: Order): boolean {
    return ['PENDIENTE', 'PREPARANDO', 'LISTO_PARA_RETIRO', 'LISTO_PARA_ENVIO'].includes(item.estado);
  }

  confirmCancel(item: Order): void {
    if (confirm(`¿Confirmas que deseas cancelar el Pedido #${item.id_pedido}? Las prendas retornarán al stock.`)) {
      this.update(item.id_pedido, 'CANCELADO');
    }
  }

  statusLabel(state: string): string {
    const map: Record<string, string> = {
      PENDIENTE: 'Por preparar',
      PREPARANDO: 'En preparación',
      LISTO_PARA_RETIRO: 'Listo para retiro',
      LISTO_PARA_ENVIO: 'Listo para envío',
      RECOGIDO: 'Recogido',
      EN_CAMINO: 'En camino',
      RETIRADO: 'Retirado en tienda',
      ENTREGADO: 'Entregado a cliente',
      CANCELADO: 'Cancelado',
    };
    return map[state] || state.replaceAll('_', ' ');
  }

  statusBadgeClass(state: string): string {
    switch (state) {
      case 'PENDIENTE':
        return 'order-badge--pending';
      case 'PREPARANDO':
        return 'order-badge--preparing';
      case 'LISTO_PARA_RETIRO':
      case 'LISTO_PARA_ENVIO':
        return 'order-badge--ready';
      case 'RETIRADO':
      case 'ENTREGADO':
        return 'order-badge--completed';
      case 'CANCELADO':
        return 'order-badge--cancelled';
      default:
        return 'order-badge--default';
    }
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
