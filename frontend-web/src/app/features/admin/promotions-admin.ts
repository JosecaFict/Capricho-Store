import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  Promotion,
  PromotionCreate,
  PromotionUpdate,
} from '../../core/models/commerce.model';
import { Category, Product, Season } from '../../core/models/catalog.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CommerceService } from '../../core/services/commerce.service';
import { CatalogService } from '../../core/services/catalog.service';

type ScopeType = 'STOREWIDE' | 'CATEGORIES' | 'SEASONS' | 'PRODUCTS';

@Component({
  selector: 'app-promotions-admin',
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  template: `
    <div class="admin-page">
      <header class="admin-page-heading">
        <div>
          <p class="eyebrow">Marketing y Ventas</p>
          <h1>Gestión de Promociones</h1>
          <p>
            Configura descuentos porcentuales automáticos por producto, categoría, temporada o para toda la tienda con vigencia programada.
          </p>
        </div>
        <div class="admin-page-heading__actions">
          <button class="button button--primary" (click)="openCreateModal()">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Nueva promoción
          </button>
        </div>
      </header>

      @if (successMessage()) {
        <div class="admin-notice admin-notice--success">
          <span>{{ successMessage() }}</span>
          <button type="button" class="button button--ghost button--small" (click)="successMessage.set(null)" style="margin-left: auto;">✕</button>
        </div>
      }

      @if (errorMessage()) {
        <div class="admin-notice admin-notice--error">
          <span>{{ errorMessage() }}</span>
          <button type="button" class="button button--ghost button--small" (click)="errorMessage.set(null)" style="margin-left: auto;">✕</button>
        </div>
      }

      <!-- KPI Grid -->
      <section class="notification-kpi-grid">
        <div class="notification-kpi-card">
          <span class="notification-kpi-card__label">Total Promociones</span>
          <strong class="notification-kpi-card__value">{{ kpis().total }}</strong>
          <span class="notification-kpi-card__sub">Registradas en el sistema</span>
        </div>
        <div class="notification-kpi-card notification-kpi-card--success">
          <span class="notification-kpi-card__label">Promociones Vigentes</span>
          <strong class="notification-kpi-card__value">{{ kpis().vigentes }}</strong>
          <span class="notification-kpi-card__sub">Activas y aplicando en tienda</span>
        </div>
        <div class="notification-kpi-card notification-kpi-card--warning">
          <span class="notification-kpi-card__label">Programadas</span>
          <strong class="notification-kpi-card__value">{{ kpis().programadas }}</strong>
          <span class="notification-kpi-card__sub">Inician en fechas futuras</span>
        </div>
        <div class="notification-kpi-card">
          <span class="notification-kpi-card__label">Descuento Promedio</span>
          <strong class="notification-kpi-card__value">{{ kpis().promedioDescuento }}%</strong>
          <span class="notification-kpi-card__sub">En ofertas vigentes</span>
        </div>
      </section>

      <!-- Tabla y Filtros -->
      <section class="table-card" style="margin-top: 1.5rem;">
        <div class="table-card__toolbar" style="display: flex; gap: 1rem; align-items: center; justify-content: space-between; flex-wrap: wrap;">
          <div class="search-wrap" style="flex: 1; min-width: 260px;">
            <input
              type="search"
              class="input-search"
              placeholder="Buscar promoción por nombre o descripción..."
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
            />
          </div>
          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <select class="input-select" [value]="statusFilter()" (change)="onStatusFilterChange($event)">
              <option value="">Todos los estados</option>
              <option value="VIGENTE">Vigentes (En curso)</option>
              <option value="PROGRAMADA">Programadas</option>
              <option value="EXPIRADA">Expiradas</option>
              <option value="INACTIVA">Inactivas</option>
            </select>
            <button class="button button--secondary button--small" (click)="loadPromotions()" [disabled]="loading()">
              🔄 Actualizar
            </button>
          </div>
        </div>

        @if (loading()) {
          <div class="table-card__empty" style="padding: 3rem; text-align: center;">
            <p>Cargando promociones...</p>
          </div>
        } @else if (filteredPromotions().length === 0) {
          <div class="table-card__empty" style="padding: 3rem; text-align: center;">
            <p>No se encontraron promociones que coincidan con los filtros.</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Promoción</th>
                  <th>Descuento</th>
                  <th>Alcance</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                  <th style="text-align: right;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (promo of filteredPromotions(); track promo.id_promocion) {
                  <tr>
                    <td>
                      <strong>{{ promo.nombre }}</strong>
                      @if (promo.descripcion) {
                        <p style="margin: 0.25rem 0 0; font-size: 0.825rem; color: var(--color-text-muted);">
                          {{ promo.descripcion }}
                        </p>
                      }
                    </td>
                    <td>
                      <span class="badge" style="background: rgba(37, 99, 235, 0.15); color: #60a5fa; font-weight: 700; font-size: 0.875rem;">
                        -{{ promo.porcentaje_descuento }}%
                      </span>
                    </td>
                    <td>
                      <span style="font-size: 0.85rem;">{{ getScopeLabel(promo) }}</span>
                    </td>
                    <td>
                      <div style="font-size: 0.825rem; line-height: 1.4;">
                        <div>{{ promo.fecha_inicio | date:'dd/MM/yyyy HH:mm' }}</div>
                        <div style="color: var(--color-text-muted);">al {{ promo.fecha_fin | date:'dd/MM/yyyy HH:mm' }}</div>
                      </div>
                    </td>
                    <td>
                      <span class="badge" [ngClass]="getStatusBadgeClass(promo.estado_vigencia)">
                        {{ promo.estado_vigencia }}
                      </span>
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 0.5rem; align-items: center;">
                        <button
                          type="button"
                          class="button button--ghost button--small"
                          [title]="promo.activo ? 'Desactivar promoción' : 'Activar promoción'"
                          (click)="toggleActive(promo)"
                        >
                          {{ promo.activo ? '⏸️ Desactivar' : '▶️ Activar' }}
                        </button>
                        <button
                          type="button"
                          class="button button--ghost button--small"
                          title="Editar promoción"
                          (click)="openEditModal(promo)"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          class="button button--ghost button--small"
                          style="color: var(--color-danger, #ef4444);"
                          title="Eliminar promoción"
                          (click)="confirmDelete(promo)"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- Modal de Creación / Edición -->
      @if (showModal()) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal-card" style="max-width: 620px; width: 100%; max-height: 90vh; overflow-y: auto;" (click)="$event.stopPropagation()">
            <header class="modal-header">
              <h2>{{ editingPromo() ? 'Editar Promoción' : 'Nueva Promoción' }}</h2>
              <button type="button" class="button button--ghost button--small" (click)="closeModal()">✕</button>
            </header>

            <form [formGroup]="promoForm" (ngSubmit)="savePromotion()" class="modal-body">
              <div class="form-group" style="margin-bottom: 1rem;">
                <label class="form-label" for="promo-name">Nombre de la promoción *</label>
                <input
                  id="promo-name"
                  type="text"
                  class="input-text"
                  formControlName="nombre"
                  placeholder="Ej. Liquidación de Invierno, Cyber Day, Descuento en Poleras..."
                />
                @if (promoForm.get('nombre')?.invalid && promoForm.get('nombre')?.touched) {
                  <p class="form-error">El nombre es obligatorio (mínimo 3 caracteres).</p>
                }
              </div>

              <div class="form-group" style="margin-bottom: 1rem;">
                <label class="form-label" for="promo-desc">Descripción (opcional)</label>
                <textarea
                  id="promo-desc"
                  class="input-textarea"
                  rows="2"
                  formControlName="descripcion"
                  placeholder="Detalles adicionales sobre las condiciones de la promoción..."
                ></textarea>
              </div>

              <div class="form-row" style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                <div class="form-group" style="flex: 1;">
                  <label class="form-label" for="promo-pct">Porcentaje de descuento (%) *</label>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input
                      id="promo-pct"
                      type="number"
                      step="0.5"
                      min="1"
                      max="100"
                      class="input-text"
                      formControlName="porcentaje_descuento"
                      placeholder="Ej. 15, 20, 50"
                    />
                    <span style="font-weight: 700; font-size: 1.1rem; color: #60a5fa;">%</span>
                  </div>
                  @if (promoForm.get('porcentaje_descuento')?.invalid && promoForm.get('porcentaje_descuento')?.touched) {
                    <p class="form-error">Debe ser entre 1% y 100%.</p>
                  }
                </div>

                <div class="form-group" style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                  <label class="form-checkbox" style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; cursor: pointer;">
                    <input type="checkbox" formControlName="activo" />
                    <span>Promoción activa</span>
                  </label>
                </div>
              </div>

              <div class="form-row" style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                <div class="form-group" style="flex: 1;">
                  <label class="form-label" for="promo-start">Fecha y hora inicio *</label>
                  <input
                    id="promo-start"
                    type="datetime-local"
                    class="input-text"
                    formControlName="fecha_inicio"
                  />
                  @if (promoForm.get('fecha_inicio')?.invalid && promoForm.get('fecha_inicio')?.touched) {
                    <p class="form-error">Fecha de inicio requerida.</p>
                  }
                </div>

                <div class="form-group" style="flex: 1;">
                  <label class="form-label" for="promo-end">Fecha y hora fin *</label>
                  <input
                    id="promo-end"
                    type="datetime-local"
                    class="input-text"
                    formControlName="fecha_fin"
                  />
                  @if (promoForm.get('fecha_fin')?.invalid && promoForm.get('fecha_fin')?.touched) {
                    <p class="form-error">Fecha de fin requerida.</p>
                  }
                </div>
              </div>

              <!-- Selector de Alcance -->
              <div class="form-group" style="margin-bottom: 1.25rem;">
                <label class="form-label">Alcance de la Promoción</label>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
                  <button
                    type="button"
                    class="button button--small"
                    [class.button--primary]="selectedScope() === 'STOREWIDE'"
                    [class.button--secondary]="selectedScope() !== 'STOREWIDE'"
                    (click)="setScope('STOREWIDE')"
                  >
                    🌐 Toda la Tienda
                  </button>
                  <button
                    type="button"
                    class="button button--small"
                    [class.button--primary]="selectedScope() === 'CATEGORIES'"
                    [class.button--secondary]="selectedScope() !== 'CATEGORIES'"
                    (click)="setScope('CATEGORIES')"
                  >
                    📁 Por Categorías
                  </button>
                  <button
                    type="button"
                    class="button button--small"
                    [class.button--primary]="selectedScope() === 'SEASONS'"
                    [class.button--secondary]="selectedScope() !== 'SEASONS'"
                    (click)="setScope('SEASONS')"
                  >
                    🍂 Por Temporada
                  </button>
                  <button
                    type="button"
                    class="button button--small"
                    [class.button--primary]="selectedScope() === 'PRODUCTS'"
                    [class.button--secondary]="selectedScope() !== 'PRODUCTS'"
                    (click)="setScope('PRODUCTS')"
                  >
                    🏷️ Por Productos
                  </button>
                </div>

                @if (selectedScope() === 'CATEGORIES') {
                  <div style="border: 1px solid var(--color-border); border-radius: 8px; padding: 0.75rem; max-height: 160px; overflow-y: auto;">
                    <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 0.5rem;">
                      Selecciona una o más categorías a las que aplicará el descuento:
                    </p>
                    @for (cat of categories(); track cat.id_categoria) {
                      <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; margin-bottom: 0.35rem; cursor: pointer;">
                        <input
                          type="checkbox"
                          [checked]="selectedCategoryIds().has(cat.id_categoria)"
                          (change)="toggleCategory(cat.id_categoria)"
                        />
                        <span>{{ cat.nombre }}</span>
                      </label>
                    }
                  </div>
                }

                @if (selectedScope() === 'SEASONS') {
                  <div style="border: 1px solid var(--color-border); border-radius: 8px; padding: 0.75rem; max-height: 160px; overflow-y: auto;">
                    <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 0.5rem;">
                      Selecciona una o más temporadas:
                    </p>
                    @for (season of seasons(); track season.id_temporada) {
                      <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; margin-bottom: 0.35rem; cursor: pointer;">
                        <input
                          type="checkbox"
                          [checked]="selectedSeasonIds().has(season.id_temporada)"
                          (change)="toggleSeason(season.id_temporada)"
                        />
                        <span>{{ season.nombre }}</span>
                      </label>
                    }
                  </div>
                }

                @if (selectedScope() === 'PRODUCTS') {
                  <div style="border: 1px solid var(--color-border); border-radius: 8px; padding: 0.75rem; max-height: 180px; overflow-y: auto;">
                    <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 0.5rem;">
                      Selecciona los productos en oferta ({{ selectedProductIds().size }} seleccionados):
                    </p>
                    @for (prod of products(); track prod.id_producto) {
                      <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; margin-bottom: 0.35rem; cursor: pointer;">
                        <input
                          type="checkbox"
                          [checked]="selectedProductIds().has(prod.id_producto)"
                          (change)="toggleProduct(prod.id_producto)"
                        />
                        <span>{{ prod.nombre }} <small style="color: var(--color-text-muted);">({{ prod.categoria }})</small></span>
                      </label>
                    }
                  </div>
                }

                @if (selectedScope() === 'STOREWIDE') {
                  <div style="background: rgba(37, 99, 235, 0.08); border: 1px dashed rgba(37, 99, 235, 0.4); border-radius: 8px; padding: 0.75rem;">
                    <span style="font-size: 0.85rem; color: #93c5fd;">
                      ℹ️ El descuento se aplicará a todos los productos del catálogo mientras la promoción esté vigente.
                    </span>
                  </div>
                }
              </div>

              <footer class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
                <button type="button" class="button button--secondary" (click)="closeModal()" [disabled]="submitting()">
                  Cancelar
                </button>
                <button type="submit" class="button button--primary" [disabled]="promoForm.invalid || submitting()">
                  {{ submitting() ? 'Guardando...' : (editingPromo() ? 'Actualizar Promoción' : 'Crear Promoción') }}
                </button>
              </footer>
            </form>
          </div>
        </div>
      }

      <!-- Modal de Confirmación de Eliminación -->
      @if (deletingPromo()) {
        <div class="modal-backdrop" (click)="deletingPromo.set(null)">
          <div class="modal-card" style="max-width: 440px;" (click)="$event.stopPropagation()">
            <header class="modal-header">
              <h2>¿Eliminar Promoción?</h2>
              <button type="button" class="button button--ghost button--small" (click)="deletingPromo.set(null)">✕</button>
            </header>
            <div class="modal-body">
              <p>
                ¿Estás seguro de que deseas eliminar permanentemente la promoción
                <strong>"{{ deletingPromo()?.nombre }}"</strong>?
              </p>
              <p style="color: var(--color-text-muted); font-size: 0.875rem; margin-top: 0.5rem;">
                Los productos asociados volverán a mostrar sus precios normales.
              </p>
            </div>
            <footer class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
              <button type="button" class="button button--secondary" (click)="deletingPromo.set(null)" [disabled]="submitting()">
                Cancelar
              </button>
              <button type="button" class="button button--primary" style="background-color: var(--color-danger, #ef4444);" (click)="executeDelete()" [disabled]="submitting()">
                {{ submitting() ? 'Eliminando...' : 'Sí, Eliminar' }}
              </button>
            </footer>
          </div>
        </div>
      }
    </div>
  `,
})
export class PromotionsAdmin implements OnInit {
  private readonly commerceService = inject(CommerceService);
  private readonly catalogService = inject(CatalogService);
  private readonly apiError = inject(ApiErrorService);
  private readonly fb = inject(FormBuilder);

  readonly promotions = signal<Promotion[]>([]);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly searchQuery = signal('');
  readonly statusFilter = signal('');
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly categories = signal<Category[]>([]);
  readonly seasons = signal<Season[]>([]);
  readonly products = signal<Product[]>([]);

  readonly showModal = signal(false);
  readonly editingPromo = signal<Promotion | null>(null);
  readonly deletingPromo = signal<Promotion | null>(null);

  readonly selectedScope = signal<ScopeType>('STOREWIDE');
  readonly selectedCategoryIds = signal<Set<number>>(new Set());
  readonly selectedSeasonIds = signal<Set<number>>(new Set());
  readonly selectedProductIds = signal<Set<number>>(new Set());

  readonly promoForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    porcentaje_descuento: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
    fecha_inicio: ['', Validators.required],
    fecha_fin: ['', Validators.required],
    activo: [true],
  });

  readonly kpis = computed(() => {
    const list = this.promotions();
    const total = list.length;
    const vigentes = list.filter((p) => p.estado_vigencia === 'VIGENTE').length;
    const programadas = list.filter((p) => p.estado_vigencia === 'PROGRAMADA').length;
    const vigentesList = list.filter((p) => p.estado_vigencia === 'VIGENTE');
    const promedioDescuento =
      vigentesList.length > 0
        ? Math.round(
            (vigentesList.reduce((acc, p) => acc + Number(p.porcentaje_descuento), 0) /
              vigentesList.length) *
              10
          ) / 10
        : 0;

    return { total, vigentes, programadas, promedioDescuento };
  });

  readonly filteredPromotions = computed(() => {
    let result = this.promotions();
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      result = result.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.descripcion && p.descripcion.toLowerCase().includes(q))
      );
    }
    const status = this.statusFilter();
    if (status) {
      result = result.filter((p) => p.estado_vigencia === status);
    }
    return result;
  });

  ngOnInit(): void {
    this.loadPromotions();
    this.loadCatalogReferences();
  }

  loadPromotions(): void {
    this.loading.set(true);
    this.commerceService
      .adminPromotions()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.promotions.set(data),
        error: (err) => this.errorMessage.set(this.apiError.message(err)),
      });
  }

  private loadCatalogReferences(): void {
    this.catalogService.options().subscribe({
      next: (options) => {
        this.categories.set(options.categories);
        this.seasons.set(options.seasons);
      },
    });
    this.catalogService.products({ page_size: 100 }).subscribe({
      next: (page) => this.products.set(page.items),
    });
  }

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  onStatusFilterChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'VIGENTE':
        return 'badge--success';
      case 'PROGRAMADA':
        return 'badge--warning';
      case 'EXPIRADA':
        return 'badge--muted';
      default:
        return 'badge--danger';
    }
  }

  getScopeLabel(promo: Promotion): string {
    if (promo.productos_count > 0) {
      return `🏷️ ${promo.productos_count} producto(s)`;
    }
    if (promo.categorias_count > 0) {
      return `📁 ${promo.categorias_count} categoría(s)`;
    }
    if (promo.temporadas_count > 0) {
      return `🍂 ${promo.temporadas_count} temporada(s)`;
    }
    return '🌐 Toda la tienda';
  }

  openCreateModal(): void {
    this.editingPromo.set(null);
    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 7);

    this.promoForm.reset({
      nombre: '',
      descripcion: '',
      porcentaje_descuento: 15,
      fecha_inicio: this.formatDateForInput(now),
      fecha_fin: this.formatDateForInput(end),
      activo: true,
    });

    this.selectedScope.set('STOREWIDE');
    this.selectedCategoryIds.set(new Set());
    this.selectedSeasonIds.set(new Set());
    this.selectedProductIds.set(new Set());
    this.showModal.set(true);
  }

  openEditModal(promo: Promotion): void {
    this.editingPromo.set(promo);
    this.promoForm.patchValue({
      nombre: promo.nombre,
      descripcion: promo.descripcion || '',
      porcentaje_descuento: promo.porcentaje_descuento,
      fecha_inicio: this.formatDateForInput(new Date(promo.fecha_inicio)),
      fecha_fin: this.formatDateForInput(new Date(promo.fecha_fin)),
      activo: promo.activo,
    });

    if (promo.producto_ids && promo.producto_ids.length > 0) {
      this.selectedScope.set('PRODUCTS');
      this.selectedProductIds.set(new Set(promo.producto_ids));
    } else if (promo.categoria_ids && promo.categoria_ids.length > 0) {
      this.selectedScope.set('CATEGORIES');
      this.selectedCategoryIds.set(new Set(promo.categoria_ids));
    } else if (promo.temporada_ids && promo.temporada_ids.length > 0) {
      this.selectedScope.set('SEASONS');
      this.selectedSeasonIds.set(new Set(promo.temporada_ids));
    } else {
      this.selectedScope.set('STOREWIDE');
    }

    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingPromo.set(null);
  }

  setScope(scope: ScopeType): void {
    this.selectedScope.set(scope);
  }

  toggleCategory(id: number): void {
    const next = new Set(this.selectedCategoryIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedCategoryIds.set(next);
  }

  toggleSeason(id: number): void {
    const next = new Set(this.selectedSeasonIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedSeasonIds.set(next);
  }

  toggleProduct(id: number): void {
    const next = new Set(this.selectedProductIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedProductIds.set(next);
  }

  savePromotion(): void {
    if (this.promoForm.invalid) return;

    const val = this.promoForm.value;
    const start = new Date(val.fecha_inicio!);
    const end = new Date(val.fecha_fin!);
    if (end <= start) {
      this.errorMessage.set('La fecha de fin debe ser posterior a la fecha de inicio.');
      return;
    }

    const scope = this.selectedScope();
    const producto_ids = scope === 'PRODUCTS' ? Array.from(this.selectedProductIds()) : [];
    const categoria_ids = scope === 'CATEGORIES' ? Array.from(this.selectedCategoryIds()) : [];
    const temporada_ids = scope === 'SEASONS' ? Array.from(this.selectedSeasonIds()) : [];

    this.submitting.set(true);
    const editing = this.editingPromo();

    if (editing) {
      const payload: PromotionUpdate = {
        nombre: val.nombre!,
        descripcion: val.descripcion || null,
        porcentaje_descuento: Number(val.porcentaje_descuento),
        fecha_inicio: start.toISOString(),
        fecha_fin: end.toISOString(),
        activo: Boolean(val.activo),
        producto_ids,
        categoria_ids,
        temporada_ids,
      };

      this.commerceService
        .updatePromotion(editing.id_promocion, payload)
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: (updated) => {
            this.successMessage.set(`Promoción "${updated.nombre}" actualizada con éxito.`);
            this.closeModal();
            this.loadPromotions();
          },
          error: (err) => this.errorMessage.set(this.apiError.message(err)),
        });
    } else {
      const payload: PromotionCreate = {
        nombre: val.nombre!,
        descripcion: val.descripcion || null,
        porcentaje_descuento: Number(val.porcentaje_descuento),
        fecha_inicio: start.toISOString(),
        fecha_fin: end.toISOString(),
        activo: Boolean(val.activo),
        producto_ids,
        categoria_ids,
        temporada_ids,
      };

      this.commerceService
        .createPromotion(payload)
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: (created) => {
            this.successMessage.set(`Promoción "${created.nombre}" creada con éxito.`);
            this.closeModal();
            this.loadPromotions();
          },
          error: (err) => this.errorMessage.set(this.apiError.message(err)),
        });
    }
  }

  toggleActive(promo: Promotion): void {
    const nextState = !promo.activo;
    this.commerceService
      .updatePromotion(promo.id_promocion, { activo: nextState })
      .subscribe({
        next: (updated) => {
          this.promotions.update((list) =>
            list.map((p) => (p.id_promocion === updated.id_promocion ? updated : p))
          );
          this.successMessage.set(
            `Promoción "${updated.nombre}" ${updated.activo ? 'activada' : 'desactivada'}.`
          );
        },
        error: (err) => this.errorMessage.set(this.apiError.message(err)),
      });
  }

  confirmDelete(promo: Promotion): void {
    this.deletingPromo.set(promo);
  }

  executeDelete(): void {
    const promo = this.deletingPromo();
    if (!promo) return;

    this.submitting.set(true);
    this.commerceService
      .deletePromotion(promo.id_promocion)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.promotions.update((list) =>
            list.filter((p) => p.id_promocion !== promo.id_promocion)
          );
          this.successMessage.set(`Promoción "${promo.nombre}" eliminada con éxito.`);
          this.deletingPromo.set(null);
        },
        error: (err) => this.errorMessage.set(this.apiError.message(err)),
      });
  }

  private formatDateForInput(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
