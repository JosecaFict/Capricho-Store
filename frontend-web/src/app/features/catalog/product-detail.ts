import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { Product, ProductImage, ProductMeasurement } from '../../core/models/catalog.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogService } from '../../core/services/catalog.service';
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
            @if (images().length > 1) {
              <div class="gallery__thumbs" aria-label="Galería de imágenes">
                @for (image of images(); track image.id_imagen) {
                  <button
                    type="button"
                    [class.active]="activeImage() === image.secure_url"
                    (click)="selectImage(image)"
                    [attr.aria-label]="'Mostrar imagen ' + ($index + 1)"
                  >
                    <img [src]="image.secure_url" [alt]="'Vista alternativa de ' + item.nombre" />
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
            <dl class="product-specs">
              <div>
                <dt>Público</dt>
                <dd>{{ item.publico_objetivo === 'HOMBRE' ? 'Hombre' : 'Mujer' }}</dd>
              </div>
              <div>
                <dt>Tallas</dt>
                <dd>{{ item.tallas_disponibles.join(', ') || 'Sin tallas publicadas' }}</dd>
              </div>
              <div>
                <dt>Colores</dt>
                <dd>{{ item.colores_disponibles.join(', ') || 'Sin colores publicados' }}</dd>
              </div>
              <div>
                <dt>Disponibilidad</dt>
                <dd>{{ availability(item) }}</dd>
              </div>
            </dl>
            @if (item.permite_vestidor) {
              <p class="feature-note">
                Este producto está marcado como compatible con vestidor. La función visual todavía
                no forma parte de esta etapa.
              </p>
            }
            <div class="scope-note">
              <strong>Consulta de producto</strong>
              <p>La compra, reserva y pago todavía no están habilitados.</p>
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
  private readonly route = inject(ActivatedRoute);
  readonly product = signal<Product | null>(null);
  readonly images = signal<ProductImage[]>([]);
  readonly measurements = signal<ProductMeasurement[]>([]);
  readonly activeImage = signal('/images/catalogo-prendas-oficiales.jpg');
  readonly activeImageIsFallback = signal(true);
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  constructor() {
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
      product: this.catalog.product(id),
      images: this.catalog.images(id).pipe(catchError(() => of([]))),
      measurements: this.catalog.measurements(id).pipe(catchError(() => of([]))),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ product, images, measurements }) => {
          this.product.set(product);
          this.images.set(images);
          this.measurements.set(measurements);
          const first =
            images.find((image) => image.es_principal)?.secure_url ??
            images[0]?.secure_url ??
            product.imagen_principal?.secure_url;
          if (first) {
            this.activeImage.set(first);
            this.activeImageIsFallback.set(false);
          }
        },
        error: (error) =>
          this.errorMessage.set(this.errors.message(error, 'No pudimos cargar el producto.')),
      });
  }

  selectImage(image: ProductImage): void {
    this.activeImage.set(image.secure_url);
    this.activeImageIsFallback.set(false);
  }
  useFallback(): void {
    this.activeImage.set('/images/catalogo-prendas-oficiales.jpg');
    this.activeImageIsFallback.set(true);
  }

  availability(item: Product): string {
    const stocks = item.variantes
      .map((variant) => variant.stock_disponible)
      .filter((stock): stock is number => typeof stock === 'number');
    if (stocks.length === 0) return 'Consulta una sucursal para conocer el stock';
    const total = stocks.reduce((sum, stock) => sum + stock, 0);
    return total > 0 ? `${total} unidades registradas` : 'Agotado';
  }
}
