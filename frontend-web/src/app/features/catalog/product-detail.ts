import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, interval, of, Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Branch, Product, ProductImage, ProductMeasurement } from '../../core/models/catalog.model';
import { RecommendedProduct } from '../../core/models/recommendation.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CommerceService } from '../../core/services/commerce.service';
import { RecommendationService } from '../../core/services/recommendation.service';
import { TryOnService } from '../../core/services/try-on.service';
import { StatusPanel } from '../../shared/components/status-panel/status-panel';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, BolivianosPipe, StatusPanel],
  template: `
    <section class="detail-page page-shell">
      <a class="back-link" routerLink="/catalogo">Volver al catálogo</a>
      @if (loading()) {
        <div class="detail-skeleton" aria-label="Cargando producto">
          <span></span>
          <div><i></i><i></i><i></i></div>
        </div>
      } @else if (errorMessage()) {
        <app-status-panel
          kind="error"
          title="No pudimos abrir este producto"
          [message]="errorMessage()"
          (retry)="load()"
        />
      } @else if (product(); as item) {
        <div class="product-detail">
          <div class="gallery">
            <div class="gallery__main">
              <img
                [src]="activeImage()"
                [alt]="
                  activeImageIsFallback()
                    ? 'Imagen temporal de polera, camisa, polo y blusa'
                    : item.nombre
                "
                (error)="useFallback()"
              />
            </div>
            @if (visibleImages().length > 1) {
              <div class="gallery__thumbs" aria-label="Galería de imágenes">
                @for (image of visibleImages(); track image.id_imagen) {
                  <button
                    type="button"
                    [class.active]="activeImage() === image.secure_url"
                    (click)="selectImage(image)"
                    [attr.aria-label]="'Mostrar imagen ' + ($index + 1)"
                  >
                    <!-- impeccable-disable-next-line broken-image: Cloudinary supplies this URL; failed thumbnails are hidden below. -->
                    <img
                      [src]="image.secure_url"
                      [alt]="'Vista alternativa de ' + item.nombre"
                      (error)="hideBrokenImage($event)"
                    />
                  </button>
                }
              </div>
            }
            @if (activeImageIsFallback()) {
              <p class="temporary-note">Imagen temporal de desarrollo.</p>
            }
          </div>
          <article class="product-info">
            <p class="product-info__meta">{{ item.marca }} · {{ item.categoria }}</p>
            <h1>{{ item.nombre }}</h1>
            @if (item.precio_promocional) {
              <div class="product-info__promo-wrap" style="display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
                <span class="product-info__price product-info__price--discount" style="color: #2563eb; font-size: 1.75rem; font-weight: 800;">
                  {{ item.precio_promocional | bolivianos }}
                </span>
                <del style="color: var(--ink-soft); font-size: 1.1rem; text-decoration: line-through;">
                  {{ item.precio_actual | bolivianos }}
                </del>
                <span class="badge" style="background: rgba(220, 38, 38, 0.15); color: #dc2626; font-weight: 800; border-radius: 999px; padding: 0.25rem 0.6rem;">
                  -{{ item.descuento_porcentaje }}% OFF
                </span>
              </div>
              @if (item.promocion_nombre) {
                <p style="font-size: 0.85rem; color: #2563eb; font-weight: 600; margin-top: -0.25rem; margin-bottom: 0.75rem;">
                  🏷️ Oferta especial: {{ item.promocion_nombre }}
                </p>
              }
            } @else {
              <p class="product-info__price">{{ item.precio_actual | bolivianos }}</p>
            }
            <p class="product-info__description">
              {{ item.descripcion || 'Este producto todavía no tiene una descripción publicada.' }}
            </p>
            @if (availableColors(item).length > 0) {
              <fieldset class="product-options product-colors">
                <legend>Color</legend>
                <div>
                  @for (color of availableColors(item); track color.id_color) {
                    <button
                      type="button"
                      [class.active]="selectedColorId() === color.id_color"
                      [disabled]="
                        selectedBranchId() !== null &&
                        (availabilityLoading() ||
                          !!availabilityError() ||
                          colorStock(item, color.id_color) === 0)
                      "
                      [attr.aria-pressed]="selectedColorId() === color.id_color"
                      [attr.aria-label]="'Seleccionar color ' + color.color"
                      [title]="color.color"
                      (click)="selectColor(color.id_color)"
                    >
                      <i [style.background]="color.codigo_hex || '#d8dadd'"></i>
                    </button>
                  }
                </div>
                <small>{{ selectedColorName(item) }}</small>
              </fieldset>
            }
            @if (availableSizes(item).length > 0) {
              <div class="product-options product-sizes">
                <strong>Talla</strong>
                <div>
                  @for (size of availableSizes(item); track size) {
                    <button
                      type="button"
                      [class.active]="selectedSize() === size"
                      [disabled]="
                        selectedBranchId() !== null &&
                        (availabilityLoading() ||
                          !!availabilityError() ||
                          sizeStock(item, size) === 0)
                      "
                      [attr.aria-pressed]="selectedSize() === size"
                      (click)="selectSize(size)"
                    >
                      {{ size }}
                    </button>
                  }
                </div>
              </div>
            }
            @if (selectedMeasurement(); as measurement) {
              <section
                class="selected-measurement"
                aria-labelledby="selected-measurement-title"
                aria-live="polite"
              >
                <h2 id="selected-measurement-title">Medidas de la talla {{ measurement.talla }}</h2>
                <dl>
                  <div>
                    <dt>Hombros</dt>
                    <dd>{{ measurementValue(measurement.ancho_hombros_cm) }}</dd>
                  </div>
                  <div>
                    <dt>Pecho</dt>
                    <dd>{{ measurementValue(measurement.ancho_pecho_cm) }}</dd>
                  </div>
                  <div>
                    <dt>Largo</dt>
                    <dd>{{ measurementValue(measurement.largo_prenda_cm) }}</dd>
                  </div>
                  <div>
                    <dt>Manga</dt>
                    <dd>{{ measurementValue(measurement.largo_manga_cm) }}</dd>
                  </div>
                </dl>
              </section>
            }
            <label class="field" for="detail-branch">
              <span>Sucursal para consultar disponibilidad</span>
              <select
                id="detail-branch"
                [value]="selectedBranchId() ?? ''"
                [disabled]="availabilityLoading()"
                aria-describedby="detail-branch-status"
                (change)="selectBranch($event)"
              >
                <option value="">Selecciona una sucursal</option>
                @for (branch of branches(); track branch.id_sucursal) {
                  <option [value]="branch.id_sucursal">{{ branch.nombre }}</option>
                }
              </select>
            </label>
            <dl class="product-specs">
              <div>
                <dt>Público</dt>
                <dd>{{ item.publico_objetivo === 'HOMBRE' ? 'Hombre' : 'Mujer' }}</dd>
              </div>
              <div>
                <dt>Tallas</dt>
                <dd>{{ availableSizes(item).join(', ') || 'Sin tallas publicadas' }}</dd>
              </div>
              <div>
                <dt>Colores</dt>
                <dd>{{ item.colores_disponibles.join(', ') || 'Sin colores publicados' }}</dd>
              </div>
              <div>
                <dt>Disponibilidad</dt>
                <dd
                  id="detail-branch-status"
                  class="branch-stock-state"
                  [class.is-loading]="availabilityLoading()"
                  [class.is-empty]="selectedBranchId() !== null && totalStock(item) === 0"
                  role="status"
                  aria-live="polite"
                >
                  {{ branchAvailability(item) }}
                </dd>
              </div>
            </dl>
            @if (item.permite_vestidor) {
              <div class="virtual-tryon-banner" role="region" aria-label="Vestidor virtual con IA">
                <div class="virtual-tryon-banner__content">
                  <span class="vton-badge"><span class="vton-sparkle">✨</span> Probador con IA</span>
                  <strong>¿Cómo me vería con esta prenda?</strong>
                  <p>Sube tu foto y pruébate los distintos colores antes de agregarlo al carrito.</p>
                </div>
                <button
                  type="button"
                  class="button button--vton"
                  (click)="openTryOnModal(item)"
                  id="btn-open-virtual-tryon"
                >
                  <span>✨</span> Probar en mi foto
                </button>
              </div>
            }
            <div class="product-purchase">
              @if (actionMessage()) {
                <p
                  class="notice"
                  [class.notice--error]="actionError()"
                  [class.notice--success]="!actionError()"
                  role="status"
                >
                  {{ actionMessage() }}
                </p>
                @if (branchConflictPrompt()) {
                  <div style="margin-top: 0.5rem;">
                    <button
                      class="button button--secondary button--full"
                      type="button"
                      (click)="clearCartAndAdd(item)"
                    >
                      Vaciar carrito actual y comprar aquí
                    </button>
                  </div>
                }
              }
              @if (auth.currentUser()) {
                <label class="field product-quantity" for="detail-quantity">
                  <span>Cantidad</span>
                  <input
                    id="detail-quantity"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    [max]="selectedVariantStock(item)"
                    [value]="quantity()"
                    [disabled]="
                      availabilityLoading() ||
                      !!availabilityError() ||
                      selectedBranchId() === null ||
                      selectedVariantStock(item) === 0
                    "
                    (input)="setQuantity($event, item)"
                  />
                  <small>
                    @if (selectedBranchId() === null) {
                      Elige una sucursal para definir el máximo disponible.
                    } @else {
                      Máximo disponible: {{ selectedVariantStock(item) }}
                    }
                  </small>
                </label>
                <button
                  class="button button--primary button--full"
                  type="button"
                  [disabled]="
                    adding() ||
                    availabilityLoading() ||
                    !!availabilityError() ||
                    selectedBranchId() === null ||
                    !selectedVariant(item) ||
                    selectedVariantStock(item) === 0 ||
                    quantity() > selectedVariantStock(item)
                  "
                  (click)="addToCart(item)"
                >
                  {{ adding() ? 'Agregando…' : 'Agregar al carrito' }}
                </button>
                <p>
                  Selecciona color, talla y sucursal. La disponibilidad se valida nuevamente al
                  confirmar.
                </p>
              } @else {
                <a class="button button--primary button--full" routerLink="/login"
                  >Ingresa para comprar o reservar</a
                >
              }
            </div>
          </article>
        </div>

        <!-- Prendas similares recomendadas (IA Híbrida) -->
        @if (similarProducts().length > 0) {
          <section class="similar-products-section" style="margin-top: 3.5rem; border-top: 1px solid var(--color-border); padding-top: 2.5rem;">
            <div style="margin-bottom: 1.5rem;">
              <div style="display: inline-flex; align-items: center; gap: 0.35rem; background: rgba(37, 99, 235, 0.1); color: #2563eb; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.35rem;">
                <span>✨ Prendas Similares</span>
              </div>
              <h2 style="font-size: 1.35rem; font-weight: 800; margin: 0 0 0.25rem;">Completa o combina tu estilo</h2>
              <p style="color: var(--color-text-muted); font-size: 0.875rem; margin: 0;">Sugerencias basadas en afinidad de categoría, corte y temporada.</p>
            </div>
            <div class="product-grid">
              @for (sim of similarProducts(); track sim.id_producto) {
                <a class="product-card" [routerLink]="['/catalogo', sim.id_producto]" style="text-decoration: none; color: inherit; display: flex; flex-direction: column;">
                  <div class="product-card__media" style="position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: #f1f5f9;">
                    <img [src]="sim.imagen_url || '/images/hero-catalogo-oficial.jpg'" [alt]="sim.nombre" style="width: 100%; height: 100%; object-fit: cover;" />
                    @if (sim.descuento_porcentaje) {
                      <span style="position: absolute; top: 8px; left: 8px; background: #dc2626; color: #fff; font-weight: 800; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px;">
                        -{{ sim.descuento_porcentaje }}%
                      </span>
                    }
                    @if (sim.motivo) {
                      <span style="position: absolute; bottom: 8px; left: 8px; background: rgba(15, 23, 42, 0.8); color: #fff; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 4px; backdrop-filter: blur(4px);">
                        {{ sim.motivo }}
                      </span>
                    }
                  </div>
                  <div style="padding: 0.75rem 0.25rem 0; flex: 1; display: flex; flex-direction: column;">
                    <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 700;">{{ sim.categoria }} · {{ sim.marca }}</span>
                    <h3 style="font-size: 0.95rem; font-weight: 700; margin: 0.25rem 0 0.4rem; line-height: 1.3;">{{ sim.nombre }}</h3>
                    <div style="display: flex; gap: 0.5rem; align-items: baseline; margin-top: auto;">
                      @if (sim.precio_promocional) {
                        <strong style="color: #2563eb; font-size: 1rem;">Bs. {{ sim.precio_promocional }}</strong>
                        <del style="font-size: 0.8rem; color: var(--color-text-muted);">Bs. {{ sim.precio_actual }}</del>
                      } @else {
                        <strong style="font-size: 1rem;">Bs. {{ sim.precio_actual }}</strong>
                      }
                    </div>
                  </div>
                </a>
              }
            </div>
          </section>
        }
      }

      <!-- MODAL INTERACTIVO DE VESTIDOR VIRTUAL -->
      @if (showTryOnModal()) {
        <div class="vton-overlay" (click)="onOverlayClick($event)" role="dialog" aria-modal="true" aria-labelledby="vton-title">
          <div class="vton-modal" (click)="$event.stopPropagation()">
            <header class="vton-modal__header">
              <div>
                <span class="vton-badge"><span class="vton-sparkle">✨</span> Probador Virtual Inteligente</span>
                <h2 id="vton-title">{{ product()?.nombre }}</h2>
                <p class="vton-modal__meta">
                  Talla: <strong>{{ selectedSize() || 'M' }}</strong> · Color: <strong>{{ tryOnActiveColorName() }}</strong>
                </p>
              </div>
              <button type="button" class="vton-close-btn" (click)="closeTryOnModal()" aria-label="Cerrar vestidor">✕</button>
            </header>

            <div class="vton-modal__body">
              <!-- ESTADO 1: SUBIDA DE FOTO -->
              @if (tryOnState() === 'upload') {
                <div class="vton-upload-state">
                  <div class="vton-guide-box">
                    <h4>📸 Consejos para una prueba perfecta:</h4>
                    <ul>
                      <li>Tómate una foto o selfie de frente, de la cintura hacia arriba.</li>
                      <li>Utiliza buena iluminación para que la IA detecte mejor tu silueta.</li>
                      <li>Evita que otros objetos o prendas holgadas tapen tu torso.</li>
                    </ul>
                  </div>

                  <div
                    class="vton-dropzone"
                    [class.has-file]="!!tryOnPhotoPreview()"
                    (click)="fileInput.click()"
                    (dragover)="onDragOver($event)"
                    (drop)="onFileDrop($event)"
                  >
                    <input
                      #fileInput
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      style="display: none;"
                      (change)="onTryOnFileSelected($event)"
                    />
                    @if (tryOnPhotoPreview()) {
                      <div class="vton-preview-wrap">
                        <img [src]="tryOnPhotoPreview()" alt="Tu foto para prueba" />
                        <span class="vton-change-badge">Haz clic para cambiar foto</span>
                      </div>
                    } @else {
                      <div class="vton-dropzone-prompt">
                        <span class="vton-upload-icon">📸</span>
                        <strong>Selecciona o arrastra una foto tuya</strong>
                        <p>Formatos soportados: JPG, PNG, WEBP (hasta 5MB)</p>
                      </div>
                    }
                  </div>

                  @if (tryOnErrorMessage()) {
                    <p class="vton-error">{{ tryOnErrorMessage() }}</p>
                  }

                  <div class="vton-upload-actions">
                    <button
                      type="button"
                      class="button button--vton button--full"
                      [disabled]="!tryOnSelectedFile()"
                      (click)="startTryOnGeneration()"
                    >
                      <span>✨</span> Iniciar Escáner y Prueba con IA
                    </button>
                  </div>
                </div>
              }

              <!-- ESTADO 2: PROCESAMIENTO Y ESCÁNER ANIMADO -->
              @if (tryOnState() === 'processing') {
                <div class="vton-processing-state">
                  <div class="vton-scanner-card">
                    <img [src]="tryOnPhotoPreview()" alt="Escaneando silueta" />
                    <div class="vton-laser-line"></div>
                  </div>

                  <div class="vton-progress-section">
                    <div class="vton-progress-meta">
                      <strong>{{ tryOnProgress() }}%</strong>
                      <span>Aproximadamente {{ tryOnEta() }} segundos restantes</span>
                    </div>
                    <div class="vton-progress-track">
                      <div class="vton-progress-bar" [style.width.%]="tryOnProgress()"></div>
                    </div>
                    <p class="vton-step-message">{{ tryOnStepMessage() }}</p>

                    <ul class="vton-step-checklist">
                      <li [class.done]="tryOnProgress() >= 25">
                        <span class="dot">✓</span> 1. Silueta y postura detectada
                      </li>
                      <li [class.done]="tryOnProgress() >= 60">
                        <span class="dot">✓</span> 2. Dimensiones y proporciones de prenda ajustadas
                      </li>
                      <li [class.done]="tryOnProgress() >= 95">
                        <span class="dot">✓</span> 3. Renderizado de caída de tela, pliegues y sombras
                      </li>
                    </ul>
                  </div>

                  <div class="vton-processing-actions">
                    <button type="button" class="button button--secondary" (click)="cancelTryOn()">
                      Cancelar
                    </button>
                  </div>
                </div>
              }

              <!-- ESTADO 3: RESULTADO INTERACTIVO Y SELECTOR DE COLORES -->
              @if (tryOnState() === 'completed') {
                <div class="vton-result-state">
                  <div class="vton-result-image-panel">
                    <div class="vton-result-view">
                      <img
                        [src]="tryOnShowBefore() ? tryOnPhotoPreview() : (tryOnResultImage() || activeImage())"
                        [alt]="tryOnShowBefore() ? 'Tu foto original' : 'Prenda puesta con IA'"
                      />
                      <span class="vton-ai-tag">
                        {{ tryOnShowBefore() ? 'Tu foto original' : '✨ Prenda Ajustada con IA' }}
                      </span>
                    </div>

                    <div class="vton-toggle-container">
                      <button
                        type="button"
                        class="vton-toggle-btn"
                        [class.active]="tryOnShowBefore()"
                        (click)="tryOnShowBefore.set(true)"
                      >
                        Antes
                      </button>
                      <button
                        type="button"
                        class="vton-toggle-btn"
                        [class.active]="!tryOnShowBefore()"
                        (click)="tryOnShowBefore.set(false)"
                      >
                        Después (Look IA)
                      </button>
                    </div>
                  </div>

                  <div class="vton-result-controls-panel">
                    <div class="vton-product-brief">
                      <span class="vton-category">{{ product()?.categoria }}</span>
                      <h3>{{ product()?.nombre }}</h3>
                      <p class="vton-selected-size">Talla: <strong>{{ selectedSize() || 'M' }}</strong></p>
                    </div>

                    <!-- SELECTOR DE COLORES EN CALIENTE -->
                    @if (product(); as currentProduct) {
                      @if (availableColors(currentProduct).length > 0) {
                        <div class="vton-color-section">
                          <label class="vton-label">
                            Color actual: <strong>{{ tryOnActiveColorName() }}</strong>
                          </label>
                          <div class="vton-color-swatches">
                            @for (color of availableColors(currentProduct); track color.id_color) {
                              <button
                                type="button"
                                class="vton-color-chip"
                                [class.active]="tryOnActiveColorId() === color.id_color"
                                [class.is-cached]="hasCachedColor(color.id_color)"
                                [title]="color.color + (hasCachedColor(color.id_color) ? ' (Generado ✓)' : '')"
                                (click)="switchTryOnColor(color.id_color, color.color)"
                              >
                                <i [style.background]="color.codigo_hex || '#d8dadd'"></i>
                                <span>{{ color.color }}</span>
                                @if (hasCachedColor(color.id_color)) {
                                  <small class="cached-badge">✓</small>
                                }
                              </button>
                            }
                          </div>
                          <small class="vton-hint">
                            Toca otro color para probarlo con tu misma foto sin volver a subirla.
                          </small>
                        </div>
                      }
                    }

                    <div class="vton-user-photo-row">
                      <div class="vton-thumb-crop">
                        <img [src]="tryOnPhotoPreview()" alt="Tu foto base" />
                      </div>
                      <div>
                        <span>Tu foto de referencia</span>
                        <button type="button" class="vton-link-btn" (click)="resetToUpload()">Cambiar foto</button>
                      </div>
                    </div>

                    <div class="vton-cta-group">
                      @if (product(); as currentProduct) {
                        <button
                          type="button"
                          class="button button--primary button--full"
                          (click)="applyAndAddToCart(currentProduct)"
                        >
                          🛒 Añadir al carrito (Talla {{ selectedSize() || 'M' }} · {{ tryOnActiveColorName() }})
                        </button>
                      }
                      <button
                        type="button"
                        class="button button--secondary button--full"
                        (click)="downloadResultImage()"
                      >
                        📥 Descargar imagen
                      </button>
                    </div>
                  </div>
                </div>
              }

              <!-- ESTADO 4: ERROR / FALLO -->
              @if (tryOnState() === 'failed') {
                <div class="vton-failed-state">
                  <span class="vton-failed-icon">⚠️</span>
                  <h3>No pudimos completar la prueba</h3>
                  <p>{{ tryOnErrorMessage() || 'Ocurrió un error inesperado al procesar la imagen.' }}</p>
                  <button type="button" class="button button--primary" (click)="resetToUpload()">
                    Intentar de nuevo
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
/** [CU-04 / CU-18] Detalle de Prenda y Probador Virtual */
export class ProductDetail implements OnDestroy {
  private readonly catalog = inject(CatalogService);
  private readonly errors = inject(ApiErrorService);
  private readonly commerce = inject(CommerceService);
  private readonly recService = inject(RecommendationService, { optional: true });
  private readonly route = inject(ActivatedRoute);
  private readonly tryOn = inject(TryOnService);
  private tryOnPollingSub?: Subscription;

  readonly auth = inject(AuthService);
  readonly product = signal<Product | null>(null);
  readonly similarProducts = signal<RecommendedProduct[]>([]);
  readonly images = signal<ProductImage[]>([]);
  readonly selectedColorId = signal<number | null>(null);
  readonly selectedSize = signal<string | null>(null);
  readonly measurements = signal<ProductMeasurement[]>([]);

  // Virtual Try-On signals
  readonly showTryOnModal = signal(false);
  readonly tryOnState = signal<'upload' | 'processing' | 'completed' | 'failed'>('upload');
  readonly tryOnProgress = signal(0);
  readonly tryOnEta = signal(15);
  readonly tryOnStepMessage = signal('Iniciando escáner...');
  readonly tryOnSelectedFile = signal<File | null>(null);
  readonly tryOnPhotoPreview = signal<string | null>(null);
  readonly tryOnResultImage = signal<string | null>(null);
  readonly tryOnTaskId = signal<string | null>(null);
  readonly tryOnActiveColorId = signal<number | null>(null);
  readonly tryOnActiveColorName = signal<string>('Color actual');
  readonly tryOnShowBefore = signal(false);
  readonly tryOnErrorMessage = signal<string | null>(null);
  readonly tryOnColorCache = signal<Record<number, string>>({});
  readonly selectedMeasurement = computed(() => {
    const size = this.selectedSize();
    return this.measurements().find((measurement) => measurement.talla === size) ?? null;
  });
  readonly branches = signal<Branch[]>([]);
  readonly selectedBranchId = signal<number | null>(null);
  readonly quantity = signal(1);
  readonly availabilityLoading = signal(false);
  readonly availabilityError = signal('');
  readonly activeImage = signal('/images/catalogo-prendas-oficiales.jpg');
  readonly activeImageIsFallback = signal(true);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly actionMessage = signal('');
  readonly actionError = signal(false);
  readonly adding = signal(false);
  readonly branchConflictPrompt = signal(false);
  readonly visibleImages = computed(() => {
    const selected = this.selectedColorId();
    const all = this.images();
    if (selected == null) return all;
    const matching = all.filter((image) => image.id_color === selected);
    return matching.length > 0 ? matching : all.filter((image) => image.id_color == null);
  });

  constructor() {
    this.catalog.branches().subscribe({ next: (branches) => this.branches.set(branches) });
    this.load();
  }

  load(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      this.loading.set(false);
      this.errorMessage.set('El identificador del producto no es válido.');
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');
    forkJoin({
      product: this.catalog.product(id, this.selectedBranchId() ?? undefined),
      images: this.catalog.images(id).pipe(catchError(() => of([]))),
      measurements: this.catalog.measurements(id).pipe(catchError(() => of([]))),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ product, images, measurements }) => {
          this.product.set(product);
          this.images.set(images);
          this.measurements.set(measurements);
          const firstColor = product.variantes.find((variant) => variant.activo)?.id_color ?? null;
          this.selectedColorId.set(firstColor);
          this.selectedSize.set(this.availableSizes(product)[0] ?? null);
          this.syncActiveImage(product);
          this.trackInteraction(product.id_producto, 'VER_PRODUCTO');
          this.loadSimilar(product.id_producto);
        },
        error: (error) =>
          this.errorMessage.set(this.errors.message(error, 'No pudimos cargar el producto.')),
      });
  }

  selectBranch(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const branchId = value ? Number(value) : null;
    this.selectedBranchId.set(branchId);
    this.quantity.set(1);
    this.availabilityError.set('');
    this.actionMessage.set('');
    this.loadBranchAvailability(branchId);
  }

  private loadBranchAvailability(branchId: number | null): void {
    const productId = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(productId) || productId <= 0) return;
    this.availabilityLoading.set(true);
    this.catalog
      .product(productId, branchId ?? undefined)
      .pipe(
        finalize(() => {
          if (this.selectedBranchId() === branchId) this.availabilityLoading.set(false);
        }),
      )
      .subscribe({
        next: (product) => {
          if (this.selectedBranchId() !== branchId) return;
          this.product.set(product);
          this.syncSelectionForAvailability(product);
        },
        error: (error) => {
          if (this.selectedBranchId() !== branchId) return;
          this.availabilityError.set(
            this.errors.message(
              error,
              'No pudimos consultar el stock de esta sucursal. Intenta nuevamente.',
            ),
          );
        },
      });
  }

  selectImage(image: ProductImage): void {
    this.activeImage.set(image.secure_url);
    this.activeImageIsFallback.set(false);
  }
  selectColor(colorId: number): void {
    this.selectedColorId.set(colorId);
    this.quantity.set(1);
    this.actionMessage.set('');
    const item = this.product();
    if (item) {
      this.selectedSize.set(this.availableSizes(item)[0] ?? null);
      this.syncActiveImage(item);
    }
  }
  selectSize(size: string): void {
    this.selectedSize.set(size);
    this.quantity.set(1);
    this.actionMessage.set('');
  }
  measurementValue(value: string | null): string {
    if (!value?.trim()) return 'No disponible';
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return `${value} cm`;
    return `${numericValue.toLocaleString('es-BO', { maximumFractionDigits: 2 })} cm`;
  }
  availableColors(item: Product) {
    return item.variantes.filter(
      (variant, index, all) =>
        variant.activo && all.findIndex((other) => other.id_color === variant.id_color) === index,
    );
  }
  availableSizes(item: Product): string[] {
    const selected = this.selectedColorId();
    return item.variantes
      .filter((variant) => variant.activo && (selected == null || variant.id_color === selected))
      .map((variant) => variant.talla)
      .filter((size, index, all) => all.indexOf(size) === index);
  }
  selectedColorName(item: Product): string {
    return (
      this.availableColors(item).find((color) => color.id_color === this.selectedColorId())
        ?.color || ''
    );
  }
  private syncActiveImage(item: Product): void {
    const current = this.visibleImages();
    if (this.selectedColorId() != null && current.length === 0) {
      this.useFallback();
      return;
    }
    const first =
      current.find((image) => image.es_principal)?.secure_url ??
      current[0]?.secure_url ??
      item.imagen_principal?.secure_url;
    if (first) {
      this.activeImage.set(first);
      this.activeImageIsFallback.set(false);
    } else {
      this.useFallback();
    }
  }
  useFallback(): void {
    this.activeImage.set('/images/catalogo-prendas-oficiales.jpg');
    this.activeImageIsFallback.set(true);
  }
  hideBrokenImage(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }

  branchAvailability(item: Product): string {
    if (this.availabilityLoading()) return 'Consultando disponibilidad…';
    if (this.availabilityError()) return this.availabilityError();
    const branchName = this.selectedBranchName();
    if (!branchName) return 'Selecciona una sucursal para conocer su stock.';
    const variant = this.selectedVariant(item);
    if (!variant) return `Selecciona color y talla para consultar el stock en ${branchName}.`;
    const stock = Math.max(0, Number(variant.stock_disponible ?? 0));
    if (stock === 0) {
      return `Sin stock de ${variant.color}, talla ${variant.talla}, en ${branchName}.`;
    }
    const unitLabel = stock === 1 ? 'unidad disponible' : 'unidades disponibles';
    return `${stock} ${unitLabel} de ${variant.color}, talla ${variant.talla}, en ${branchName}.`;
  }

  totalStock(item: Product): number {
    return item.variantes.reduce(
      (total, variant) => total + Math.max(0, Number(variant.stock_disponible ?? 0)),
      0,
    );
  }

  colorStock(item: Product, colorId: number): number {
    return item.variantes
      .filter((variant) => variant.activo && variant.id_color === colorId)
      .reduce((total, variant) => total + Math.max(0, Number(variant.stock_disponible ?? 0)), 0);
  }

  sizeStock(item: Product, size: string): number {
    return item.variantes
      .filter(
        (variant) =>
          variant.activo && variant.id_color === this.selectedColorId() && variant.talla === size,
      )
      .reduce((total, variant) => total + Math.max(0, Number(variant.stock_disponible ?? 0)), 0);
  }

  private selectedBranchName(): string {
    const selected = this.selectedBranchId();
    return selected === null
      ? ''
      : (this.branches().find((branch) => branch.id_sucursal === selected)?.nombre ?? '');
  }

  private syncSelectionForAvailability(item: Product): void {
    if (this.selectedBranchId() === null || this.totalStock(item) === 0) return;
    const currentColor = this.selectedColorId();
    const colorId =
      currentColor !== null && this.colorStock(item, currentColor) > 0
        ? currentColor
        : (item.variantes.find(
            (variant) => variant.activo && Number(variant.stock_disponible ?? 0) > 0,
          )?.id_color ?? null);
    this.selectedColorId.set(colorId);
    const currentSize = this.selectedSize();
    const size =
      currentSize && this.sizeStock(item, currentSize) > 0
        ? currentSize
        : (item.variantes.find(
            (variant) =>
              variant.activo &&
              variant.id_color === colorId &&
              Number(variant.stock_disponible ?? 0) > 0,
          )?.talla ?? null);
    this.selectedSize.set(size);
    this.quantity.set(1);
    this.syncActiveImage(item);
  }

  selectedVariant(item: Product) {
    return item.variantes.find(
      (variant) =>
        variant.activo &&
        variant.id_color === this.selectedColorId() &&
        variant.talla === this.selectedSize(),
    );
  }

  selectedVariantStock(item: Product): number {
    return Math.max(0, Number(this.selectedVariant(item)?.stock_disponible ?? 0));
  }

  setQuantity(event: Event, item: Product): void {
    const input = event.target as HTMLInputElement;
    const maximum = this.selectedVariantStock(item);
    const requested = Number.parseInt(input.value, 10);
    const next =
      maximum > 0 && Number.isInteger(requested) ? Math.min(Math.max(requested, 1), maximum) : 1;
    this.quantity.set(next);
    input.value = String(next);
    this.actionMessage.set('');
  }

  addToCart(item: Product): void {
    const variant = this.selectedVariant(item);
    if (!variant) return;
    const quantity = this.quantity();
    const branchId = this.selectedBranchId();
    this.adding.set(true);
    this.actionMessage.set('');
    this.branchConflictPrompt.set(false);
    this.commerce
      .addCartItem(variant.id_variante, quantity, branchId)
      .pipe(finalize(() => this.adding.set(false)))
      .subscribe({
        next: () => {
          this.actionError.set(false);
          this.branchConflictPrompt.set(false);
          this.actionMessage.set(
            quantity === 1
              ? 'La prenda se agregó al carrito.'
              : `Se agregaron ${quantity} unidades al carrito.`,
          );
          this.trackInteraction(item.id_producto, 'AGREGAR_CARRITO');
        },
        error: (error) => {
          this.actionError.set(true);
          const rawMessage = this.errors.message(error, 'No pudimos agregar la prenda al carrito.');
          this.actionMessage.set(rawMessage);
          if (rawMessage.includes('otra sucursal') || rawMessage.includes('vaciar el carrito')) {
            this.branchConflictPrompt.set(true);
          }
        },
      });
  }

  clearCartAndAdd(item: Product): void {
    this.adding.set(true);
    this.actionMessage.set('');
    this.commerce
      .clearCart()
      .pipe(finalize(() => this.adding.set(false)))
      .subscribe({
        next: () => {
          this.branchConflictPrompt.set(false);
          this.addToCart(item);
        },
        error: (error) => {
          this.actionError.set(true);
          this.actionMessage.set(
            this.errors.message(error, 'No se pudo vaciar el carrito actual.'),
          );
        },
      });
  }

  private trackInteraction(productId: number, type: 'VER_PRODUCTO' | 'AGREGAR_CARRITO'): void {
    if (!this.recService) return;
    this.recService.trackInteraction({ id_producto: productId, tipo_interaccion: type }).subscribe({
      error: () => {},
    });
  }

  private loadSimilar(productId: number): void {
    if (!this.recService) return;
    this.recService.getRelatedProducts(productId, 4).subscribe({
      next: (items) => this.similarProducts.set(items),
      error: () => {},
    });
  }

  // ==========================================
  // VIRTUAL TRY-ON (VESTIDOR CON IA) METHODS
  // ==========================================

  openTryOnModal(item: Product): void {
    this.showTryOnModal.set(true);
    const activeColorId = this.selectedColorId() ?? (item.variantes[0]?.id_color ?? null);
    const available = this.availableColors(item);
    const colorObj = available.find((c) => c.id_color === activeColorId);
    this.tryOnActiveColorId.set(activeColorId);
    this.tryOnActiveColorName.set(colorObj?.color ?? 'Color oficial');

    if (activeColorId && this.tryOnColorCache()[activeColorId]) {
      this.tryOnResultImage.set(this.tryOnColorCache()[activeColorId]);
      this.tryOnState.set('completed');
    } else if (!this.tryOnSelectedFile()) {
      this.tryOnState.set('upload');
    }
  }

  closeTryOnModal(): void {
    this.stopTryOnPolling();
    this.showTryOnModal.set(false);
  }

  onOverlayClick(event: MouseEvent): void {
    this.closeTryOnModal();
  }

  onTryOnFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.handleTryOnFile(target.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleTryOnFile(event.dataTransfer.files[0]);
    }
  }

  private handleTryOnFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.tryOnErrorMessage.set('Por favor sube un archivo de imagen (JPG, PNG o WEBP).');
      return;
    }
    this.tryOnErrorMessage.set(null);
    this.tryOnSelectedFile.set(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      this.tryOnPhotoPreview.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  startTryOnGeneration(): void {
    const file = this.tryOnSelectedFile();
    const prod = this.product();
    if (!file || !prod) return;

    this.stopTryOnPolling();
    this.tryOnState.set('processing');
    this.tryOnProgress.set(10);
    this.tryOnEta.set(15);
    this.tryOnStepMessage.set('Iniciando detección de silueta...');
    this.tryOnErrorMessage.set(null);

    const colorId = this.tryOnActiveColorId();
    const colorName = this.tryOnActiveColorName();

    this.tryOn.createTask(file, prod.id_producto, colorId, colorName).subscribe({
      next: (res) => {
        this.tryOnTaskId.set(res.task_id);
        this.startTryOnPolling(res.task_id);
      },
      error: (err) => {
        this.tryOnState.set('failed');
        this.tryOnErrorMessage.set(
          this.errors.message(err, 'No se pudo iniciar la prueba con IA.'),
        );
      },
    });
  }

  private startTryOnPolling(taskId: string): void {
    this.tryOnPollingSub = interval(2000).subscribe(() => {
      this.tryOn.getTaskStatus(taskId).subscribe({
        next: (status) => {
          if (status.status === 'completed') {
            this.tryOnProgress.set(100);
            this.tryOnEta.set(0);
            this.tryOnStepMessage.set(status.step_message);
            const resultUrl = status.result_image_url || this.activeImage();
            this.tryOnResultImage.set(resultUrl);

            const activeColorId = this.tryOnActiveColorId();
            if (activeColorId) {
              const currentCache = { ...this.tryOnColorCache(), [activeColorId]: resultUrl };
              this.tryOnColorCache.set(currentCache);
            }
            this.tryOnState.set('completed');
            this.stopTryOnPolling();
          } else if (status.status === 'failed') {
            this.tryOnState.set('failed');
            this.tryOnErrorMessage.set(status.error || 'Ocurrió un error al procesar tu look.');
            this.stopTryOnPolling();
          } else {
            this.tryOnProgress.set(status.progress);
            this.tryOnEta.set(status.eta_seconds);
            this.tryOnStepMessage.set(status.step_message);
          }
        },
        error: () => {
          // Retry on next tick
        },
      });
    });
  }

  private stopTryOnPolling(): void {
    if (this.tryOnPollingSub) {
      this.tryOnPollingSub.unsubscribe();
      this.tryOnPollingSub = undefined;
    }
  }

  cancelTryOn(): void {
    this.stopTryOnPolling();
    this.tryOnState.set('upload');
  }

  hasCachedColor(colorId: number): boolean {
    return !!this.tryOnColorCache()[colorId];
  }

  switchTryOnColor(colorId: number, colorName: string): void {
    this.tryOnActiveColorId.set(colorId);
    this.tryOnActiveColorName.set(colorName);

    if (this.hasCachedColor(colorId)) {
      this.tryOnResultImage.set(this.tryOnColorCache()[colorId]);
      this.tryOnShowBefore.set(false);
    } else if (this.tryOnSelectedFile()) {
      this.startTryOnGeneration();
    }
  }

  resetToUpload(): void {
    this.stopTryOnPolling();
    this.tryOnState.set('upload');
    this.tryOnShowBefore.set(false);
  }

  applyAndAddToCart(item: Product): void {
    const colorId = this.tryOnActiveColorId();
    if (colorId) {
      this.selectColor(colorId);
    }
    this.closeTryOnModal();
    this.addToCart(item);
  }

  downloadResultImage(): void {
    const url = this.tryOnResultImage() || this.activeImage();
    window.open(url, '_blank');
  }

  ngOnDestroy(): void {
    this.stopTryOnPolling();
  }
}
