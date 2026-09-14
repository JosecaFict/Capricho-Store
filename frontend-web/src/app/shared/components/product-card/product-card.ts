import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../../../core/models/catalog.model';
import { BolivianosPipe } from '../../pipes/bolivianos.pipe';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, BolivianosPipe],
  template: `
    <article class="product-card">
      <a
        class="product-card__image-link"
        [routerLink]="['/productos', product().id_producto]"
        [attr.aria-label]="'Ver ' + product().nombre"
      >
        <img
          class="product-card__image"
          [src]="imageUrl()"
          [alt]="
            isFallback() ? 'Imagen temporal con polera, camisa, polo y blusa' : product().nombre
          "
          loading="lazy"
          (error)="useFallback()"
        />
        @if (product().descuento_porcentaje) {
          <span class="product-card__promo-badge">-{{ product().descuento_porcentaje }}% OFF</span>
        }
        @if (isFallback()) {
          <span class="product-card__temporary">Imagen temporal</span>
        }
      </a>
      <div class="product-card__content">
        <p class="product-card__meta">{{ product().marca }} · {{ product().categoria }}</p>
        <h3>
          <a [routerLink]="['/productos', product().id_producto]">{{ product().nombre }}</a>
        </h3>
        <div class="product-card__footer">
          <div class="product-card__price-wrap">
            @if (product().precio_promocional) {
              <p class="product-card__price product-card__price--discounted">
                {{ product().precio_promocional | bolivianos }}
              </p>
              <del class="product-card__price-original">
                {{ product().precio_actual | bolivianos }}
              </del>
            } @else {
              <p class="product-card__price">{{ product().precio_actual | bolivianos }}</p>
            }
          </div>
          <span class="product-card__audience">{{
            product().publico_objetivo === 'HOMBRE' ? 'Hombre' : 'Mujer'
          }}</span>
        </div>
        <a class="text-link" [routerLink]="['/productos', product().id_producto]">Ver producto</a>
      </div>
    </article>
  `,
})
export class ProductCard {
  readonly product = input.required<Product>();
  private readonly imageLoadFailed = signal(false);
  readonly isFallback = computed(
    () => this.imageLoadFailed() || !this.product().imagen_principal?.secure_url,
  );

  imageUrl(): string {
    return this.isFallback() || !this.product().imagen_principal?.secure_url
      ? '/images/catalogo-prendas-oficiales.jpg'
      : this.product().imagen_principal!.secure_url;
  }

  useFallback(): void {
    this.imageLoadFailed.set(true);
  }
}
