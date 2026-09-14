import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { CustomerAdminSummary } from '../../core/models/commerce.model';
import {
  RecommendationConfig,
  RecommendationStats,
  RecommendedProduct,
} from '../../core/models/recommendation.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CommerceService } from '../../core/services/commerce.service';
import { RecommendationService } from '../../core/services/recommendation.service';

@Component({
  selector: 'app-recommendations-admin',
  imports: [CommonModule, FormsModule, DecimalPipe],
  template: `
    <div class="admin-page">
      <header class="admin-page-heading">
        <div>
          <p class="eyebrow">Inteligencia Artificial y Marketing</p>
          <h1>Motor Recomendador Híbrido</h1>
          <p>
            Calibra los pesos porcentuales del algoritmo de scoring predictivo y simula recomendaciones en tiempo real para cualquier cliente.
          </p>
        </div>
        <div class="admin-page-heading__actions">
          <button class="button button--secondary" (click)="resetToDefaults()" [disabled]="saving()">
            ↺ Restablecer valores recomendados
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
          <span class="notification-kpi-card__label">Interacciones Capturadas</span>
          <strong class="notification-kpi-card__value">{{ stats()?.total_interacciones ?? 0 }}</strong>
          <span class="notification-kpi-card__sub">Vistas, probador, carritos y compras</span>
        </div>
        <div class="notification-kpi-card notification-kpi-card--success">
          <span class="notification-kpi-card__label">Clientes con Perfil</span>
          <strong class="notification-kpi-card__value">{{ stats()?.clientes_con_interacciones ?? 0 }}</strong>
          <span class="notification-kpi-card__sub">Con afinidad calculada</span>
        </div>
        <div class="notification-kpi-card notification-kpi-card--warning">
          <span class="notification-kpi-card__label">Factor Principal</span>
          <strong class="notification-kpi-card__value">{{ topFactorLabel() }}</strong>
          <span class="notification-kpi-card__sub">Mayor peso en el scoring</span>
        </div>
        <div class="notification-kpi-card">
          <span class="notification-kpi-card__label">Estado del Algoritmo</span>
          <strong class="notification-kpi-card__value" [style.color]="isSumValid() ? '#10b981' : '#ef4444'">
            {{ isSumValid() ? '✓ Calibrado' : '⚠ Desajustado' }}
          </strong>
          <span class="notification-kpi-card__sub">Suma actual: {{ totalWeight() }}% / 100%</span>
        </div>
      </section>

      <!-- Panel de Calibración de Pesos -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
        <section class="table-card">
          <header class="table-card__header" style="border-bottom: 1px solid var(--color-border); padding: 1.25rem 1.5rem;">
            <div>
              <h2 style="font-size: 1.15rem; margin: 0;">Ponderación de Factores (Scoring Multi-Variable)</h2>
              <p style="font-size: 0.85rem; color: var(--color-text-muted); margin: 0.25rem 0 0;">
                Ajusta la influencia relativa de cada atributo. La suma total de los 6 pesos debe ser exactamente <strong>100%</strong>.
              </p>
            </div>
          </header>

          <div style="padding: 1.5rem;">
            <!-- Sum Indicator Bar -->
            <div style="margin-bottom: 1.5rem; padding: 1rem; border-radius: 8px;"
                 [style.background]="isSumValid() ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'"
                 [style.border]="isSumValid() ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span style="font-weight: 600; font-size: 0.9rem;" [style.color]="isSumValid() ? '#10b981' : '#ef4444'">
                  {{ isSumValid() ? '✓ Ponderación matemática válida (100%)' : '⚠ La suma debe dar exactamente 100%' }}
                </span>
                <strong style="font-size: 1.1rem;" [style.color]="isSumValid() ? '#10b981' : '#ef4444'">
                  {{ totalWeight() }}%
                </strong>
              </div>
              <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden;">
                <div [style.width.%]="Math.min(totalWeight(), 100)"
                     [style.background]="isSumValid() ? '#10b981' : '#ef4444'"
                     style="height: 100%; transition: width 200ms ease;"></div>
              </div>
            </div>

            <!-- Sliders -->
            <div class="weight-sliders" style="display: flex; flex-direction: column; gap: 1.25rem;">
              <!-- 1. Categoría -->
              <div class="weight-row">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
                  <label for="w-cat" style="font-weight: 600; font-size: 0.875rem;">📁 Categoría de la prenda</label>
                  <span style="font-weight: 700; color: #60a5fa;">{{ pesoCategoria() }}%</span>
                </div>
                <input
                  id="w-cat"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  [ngModel]="pesoCategoria()"
                  (ngModelChange)="pesoCategoria.set(+$event)"
                  style="width: 100%;"
                />
              </div>

              <!-- 2. Marca -->
              <div class="weight-row">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
                  <label for="w-brand" style="font-weight: 600; font-size: 0.875rem;">🏷️ Marca favorita</label>
                  <span style="font-weight: 700; color: #60a5fa;">{{ pesoMarca() }}%</span>
                </div>
                <input
                  id="w-brand"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  [ngModel]="pesoMarca()"
                  (ngModelChange)="pesoMarca.set(+$event)"
                  style="width: 100%;"
                />
              </div>

              <!-- 3. Color -->
              <div class="weight-row">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
                  <label for="w-color" style="font-weight: 600; font-size: 0.875rem;">🎨 Color preferido</label>
                  <span style="font-weight: 700; color: #60a5fa;">{{ pesoColor() }}%</span>
                </div>
                <input
                  id="w-color"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  [ngModel]="pesoColor()"
                  (ngModelChange)="pesoColor.set(+$event)"
                  style="width: 100%;"
                />
              </div>

              <!-- 4. Talla -->
              <div class="weight-row">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
                  <label for="w-size" style="font-weight: 600; font-size: 0.875rem;">📏 Disponibilidad en su talla</label>
                  <span style="font-weight: 700; color: #60a5fa;">{{ pesoTalla() }}%</span>
                </div>
                <input
                  id="w-size"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  [ngModel]="pesoTalla()"
                  (ngModelChange)="pesoTalla.set(+$event)"
                  style="width: 100%;"
                />
              </div>

              <!-- 5. Temporada -->
              <div class="weight-row">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
                  <label for="w-season" style="font-weight: 600; font-size: 0.875rem;">🍂 Colección de temporada</label>
                  <span style="font-weight: 700; color: #60a5fa;">{{ pesoTemporada() }}%</span>
                </div>
                <input
                  id="w-season"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  [ngModel]="pesoTemporada()"
                  (ngModelChange)="pesoTemporada.set(+$event)"
                  style="width: 100%;"
                />
              </div>

              <!-- 6. Promoción -->
              <div class="weight-row">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
                  <label for="w-promo" style="font-weight: 600; font-size: 0.875rem;">🏷️ Descuento u oferta activa</label>
                  <span style="font-weight: 700; color: #60a5fa;">{{ pesoPromocion() }}%</span>
                </div>
                <input
                  id="w-promo"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  [ngModel]="pesoPromocion()"
                  (ngModelChange)="pesoPromocion.set(+$event)"
                  style="width: 100%;"
                />
              </div>
            </div>

            <div style="margin-top: 2rem; display: flex; justify-content: flex-end;">
              <button
                class="button button--primary"
                [disabled]="!isSumValid() || saving()"
                (click)="saveWeights()"
              >
                {{ saving() ? 'Guardando...' : '💾 Guardar Calibración de Pesos' }}
              </button>
            </div>
          </div>
        </section>

        <!-- Simulador en Vivo para Clientes -->
        <section class="table-card">
          <header class="table-card__header" style="border-bottom: 1px solid var(--color-border); padding: 1.25rem 1.5rem;">
            <div>
              <h2 style="font-size: 1.15rem; margin: 0;">Simulador en Tiempo Real</h2>
              <p style="font-size: 0.85rem; color: var(--color-text-muted); margin: 0.25rem 0 0;">
                Prueba cómo evalúa el algoritmo a cualquier cliente registrado según su historial de vistas y compras.
              </p>
            </div>
          </header>

          <div style="padding: 1.5rem;">
            <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1.25rem;">
              <select
                class="input-select"
                style="flex: 1;"
                [ngModel]="selectedClientId()"
                (ngModelChange)="onClientSelect(+$event)"
              >
                <option [ngValue]="null">-- Seleccionar cliente para simular --</option>
                @for (c of customers(); track c.id_cliente) {
                  <option [value]="c.id_cliente">
                    {{ c.nombres }} {{ c.apellidos || '' }} ({{ c.total_pedidos }} compras)
                  </option>
                }
              </select>
              <button
                class="button button--secondary"
                [disabled]="!selectedClientId() || simulating()"
                (click)="runSimulation()"
              >
                {{ simulating() ? 'Simulando...' : '🚀 Simular' }}
              </button>
            </div>

            @if (simulating()) {
              <div style="padding: 3rem; text-align: center; color: var(--color-text-muted);">
                <p>Calculando afinidad y scoring predictivo...</p>
              </div>
            } @else if (simulatedItems().length > 0) {
              <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 480px; overflow-y: auto;">
                @for (item of simulatedItems(); track item.id_producto) {
                  <div style="border: 1px solid var(--color-border); border-radius: 8px; padding: 0.75rem; background: rgba(255,255,255,0.02); display: flex; gap: 0.75rem; align-items: center;">
                    @if (item.imagen_url) {
                      <img [src]="item.imagen_url" alt="" style="width: 52px; height: 64px; object-fit: cover; border-radius: 6px;" />
                    } @else {
                      <div style="width: 52px; height: 64px; background: var(--surface-muted); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                        👕
                      </div>
                    }
                    <div style="flex: 1; min-width: 0;">
                      <div style="display: flex; justify-content: space-between; align-items: baseline;">
                        <strong style="font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          {{ item.nombre }}
                        </strong>
                        <span style="font-size: 0.95rem; font-weight: 800; color: #10b981;">
                          {{ item.puntuacion | number:'1.1-1' }} pts
                        </span>
                      </div>
                      <p style="font-size: 0.8rem; color: var(--color-text-muted); margin: 0.15rem 0;">
                        {{ item.categoria }} · {{ item.marca }}
                      </p>
                      @if (item.motivo) {
                        <p style="font-size: 0.75rem; color: #60a5fa; margin: 0;">
                          💡 {{ item.motivo }}
                        </p>
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div style="padding: 3rem 1rem; text-align: center; color: var(--color-text-muted); border: 1px dashed var(--color-border); border-radius: 8px;">
                <p style="margin: 0; font-size: 0.9rem;">
                  Selecciona un cliente y presiona <strong>"Simular"</strong> para ver los productos ordenados por afinidad.
                </p>
              </div>
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class RecommendationsAdmin implements OnInit {
  private readonly recService = inject(RecommendationService);
  private readonly commerceService = inject(CommerceService);
  private readonly apiError = inject(ApiErrorService);

  readonly Math = Math;

  readonly config = signal<RecommendationConfig | null>(null);
  readonly stats = signal<RecommendationStats | null>(null);
  readonly customers = signal<CustomerAdminSummary[]>([]);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly simulating = signal(false);

  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // Sliders state
  readonly pesoCategoria = signal(40);
  readonly pesoMarca = signal(20);
  readonly pesoColor = signal(15);
  readonly pesoTalla = signal(10);
  readonly pesoTemporada = signal(10);
  readonly pesoPromocion = signal(5);

  readonly totalWeight = computed(
    () =>
      this.pesoCategoria() +
      this.pesoMarca() +
      this.pesoColor() +
      this.pesoTalla() +
      this.pesoTemporada() +
      this.pesoPromocion()
  );

  readonly isSumValid = computed(() => this.totalWeight() === 100);

  readonly topFactorLabel = computed(() => {
    const pairs = [
      { name: 'Categoría', val: this.pesoCategoria() },
      { name: 'Marca', val: this.pesoMarca() },
      { name: 'Color', val: this.pesoColor() },
      { name: 'Talla', val: this.pesoTalla() },
      { name: 'Temporada', val: this.pesoTemporada() },
      { name: 'Promoción', val: this.pesoPromocion() },
    ];
    pairs.sort((a, b) => b.val - a.val);
    return `${pairs[0].name} (${pairs[0].val}%)`;
  });

  readonly selectedClientId = signal<number | null>(null);
  readonly simulatedItems = signal<RecommendedProduct[]>([]);

  ngOnInit(): void {
    this.loadConfig();
    this.loadStats();
    this.loadCustomers();
  }

  loadConfig(): void {
    this.loading.set(true);
    this.recService
      .getConfig()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (c) => {
          this.config.set(c);
          this.pesoCategoria.set(Number(c.peso_categoria));
          this.pesoMarca.set(Number(c.peso_marca));
          this.pesoColor.set(Number(c.peso_color));
          this.pesoTalla.set(Number(c.peso_talla));
          this.pesoTemporada.set(Number(c.peso_temporada));
          this.pesoPromocion.set(Number(c.peso_promocion));
        },
        error: (err) => this.errorMessage.set(this.apiError.message(err)),
      });
  }

  loadStats(): void {
    this.recService.getStats().subscribe({
      next: (s) => this.stats.set(s),
    });
  }

  loadCustomers(): void {
    this.commerceService.adminCustomers().subscribe({
      next: (data: any) => {
        const list = Array.isArray(data) ? data : (data?.items || []);
        this.customers.set(list);
      },
    });
  }

  resetToDefaults(): void {
    this.pesoCategoria.set(40);
    this.pesoMarca.set(20);
    this.pesoColor.set(15);
    this.pesoTalla.set(10);
    this.pesoTemporada.set(10);
    this.pesoPromocion.set(5);
  }

  saveWeights(): void {
    if (!this.isSumValid()) return;

    this.saving.set(true);
    this.recService
      .updateConfig({
        peso_categoria: this.pesoCategoria(),
        peso_marca: this.pesoMarca(),
        peso_color: this.pesoColor(),
        peso_talla: this.pesoTalla(),
        peso_temporada: this.pesoTemporada(),
        peso_promocion: this.pesoPromocion(),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.config.set(updated);
          this.successMessage.set('Calibración de pesos guardada exitosamente.');
          this.loadStats();
        },
        error: (err) => this.errorMessage.set(this.apiError.message(err)),
      });
  }

  onClientSelect(id: number | null): void {
    this.selectedClientId.set(id);
    this.simulatedItems.set([]);
  }

  runSimulation(): void {
    const id = this.selectedClientId();
    if (!id) return;

    this.simulating.set(true);
    this.recService
      .simulateForClient(id, 6)
      .pipe(finalize(() => this.simulating.set(false)))
      .subscribe({
        next: (items) => this.simulatedItems.set(items),
        error: (err) => this.errorMessage.set(this.apiError.message(err)),
      });
  }
}
