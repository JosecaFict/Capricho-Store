import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Branch, Product, ProductImage, ProductMeasurement } from '../../core/models/catalog.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CommerceService } from '../../core/services/commerce.service';
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
            <p class="product-info__price">{{ item.precio_actual | bolivianos }}</p>
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
                      (click)="selectedSize.set(size)"
                    >
                      {{ size }}
                    </button>
                  }
                </div>
              </div>
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
            <p
              id="detail-branch-status"
              class="branch-stock-state"
              [class.is-loading]="availabilityLoading()"
              [class.is-empty]="selectedBranchId() !== null && totalStock(item) === 0"
              role="status"
              aria-live="polite"
            >
              {{ branchAvailability(item) }}
            </p>
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
            </dl>
            @if (item.permite_vestidor) {
              <p class="feature-note">
                Este producto está marcado como compatible con vestidor. La función visual todavía
                no forma parte de esta etapa.
              </p>
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
              }
              @if (auth.currentUser()) {
                <button
                  class="button button--primary button--full"
                  type="button"
                  [disabled]="
                    adding() ||
                    availabilityLoading() ||
                    !!availabilityError() ||
                    selectedBranchId() === null ||
                    !selectedVariant(item) ||
                    selectedVariant(item)!.stock_disponible === 0
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
        @if (measurements().length > 0) {
          <section class="measurements" aria-labelledby="measurements-title">
            <div class="section-heading">
              <h2 id="measurements-title">Medidas publicadas</h2>
              <p>Valores en centímetros según talla.</p>
            </div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Talla</th>
                    <th>Hombros</th>
                    <th>Pecho</th>
                    <th>Largo</th>
                    <th>Manga</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of measurements(); track row.id_medida) {
                    <tr>
                      <th>{{ row.talla }}</th>
                      <td>{{ row.ancho_hombros_cm || 'No disponible' }}</td>
                      <td>{{ row.ancho_pecho_cm || 'No disponible' }}</td>
                      <td>{{ row.largo_prenda_cm || 'No disponible' }}</td>
                      <td>{{ row.largo_manga_cm || 'No disponible' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
      }
    </section>
  `,
})
export class ProductDetail {
  private readonly catalog = inject(CatalogService);
  private readonly errors = inject(ApiErrorService);
  private readonly commerce = inject(CommerceService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  readonly product = signal<Product | null>(null);
  readonly images = signal<ProductImage[]>([]);
  readonly selectedColorId = signal<number | null>(null);
  readonly selectedSize = signal<string | null>(null);
  readonly measurements = signal<ProductMeasurement[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly selectedBranchId = signal<number | null>(null);
  readonly availabilityLoading = signal(false);
  readonly availabilityError = signal('');
  readonly activeImage = signal('/images/catalogo-prendas-oficiales.jpg');
  readonly activeImageIsFallback = signal(true);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly actionMessage = signal('');
  readonly actionError = signal(false);
  readonly adding = signal(false);
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
        },
        error: (error) =>
          this.errorMessage.set(this.errors.message(error, 'No pudimos cargar el producto.')),
      });
  }

  selectBranch(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const branchId = value ? Number(value) : null;
    this.selectedBranchId.set(branchId);
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
    const item = this.product();
    if (item) {
      this.selectedSize.set(this.availableSizes(item)[0] ?? null);
      this.syncActiveImage(item);
    }
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

  addToCart(item: Product): void {
    const variant = this.selectedVariant(item);
    if (!variant) return;
    this.adding.set(true);
    this.actionMessage.set('');
    this.commerce
      .addCartItem(variant.id_variante)
      .pipe(finalize(() => this.adding.set(false)))
      .subscribe({
        next: () => {
          this.actionError.set(false);
          this.actionMessage.set('La prenda se agregó al carrito.');
        },
        error: (error) => {
          this.actionError.set(true);
          this.actionMessage.set(
            this.errors.message(error, 'No pudimos agregar la prenda al carrito.'),
          );
        },
      });
  }
}
