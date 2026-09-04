import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import {
  CatalogFilters,
  CatalogOptions,
  ProductPage,
  ProductSort,
  TargetAudience,
} from '../../core/models/catalog.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogService } from '../../core/services/catalog.service';
import { ProductCard } from '../../shared/components/product-card/product-card';
import { StatusPanel } from '../../shared/components/status-panel/status-panel';

const EMPTY_OPTIONS: CatalogOptions = {
  categories: [],
  brands: [],
  sizes: [],
  colors: [],
  seasons: [],
};
const EMPTY_PAGE: ProductPage = { items: [], page: 1, page_size: 12, total: 0, pages: 0 };

@Component({
  selector: 'app-catalog',
  imports: [ReactiveFormsModule, ProductCard, StatusPanel],
  template: `
    <section class="catalog-page page-shell">
      <header class="catalog-heading">
        <div>
          <h1>Catálogo</h1>
          <p>Poleras, camisas, polos y blusas disponibles en la API.</p>
        </div>
        <p class="catalog-count">
          {{ page().total }} {{ page().total === 1 ? 'producto' : 'productos' }}
        </p>
      </header>

      <form class="catalog-controls" [formGroup]="form" (ngSubmit)="applyFilters()">
        <div class="catalog-mobile-bar">
          <button
            #mobileFilterTrigger
            class="mobile-filter-trigger"
            type="button"
            aria-controls="catalog-filter-drawer"
            [attr.aria-expanded]="mobileFiltersOpen()"
            (click)="openMobileFilters()"
          >
            Filtros
            @if (activeFilterCount() > 0) {
              <span>{{ activeFilterCount() }}</span>
            }
          </button>

          <label class="sort-field" for="sort-filter">
            <span class="sort-field__caption">Ordenar</span>
            <select id="sort-filter" formControlName="sort" (change)="applySort()">
              <option value="nombre">Nombre A a Z</option>
              <option value="-nombre">Nombre Z a A</option>
              <option value="precio">Precio menor</option>
              <option value="-precio">Precio mayor</option>
              <option value="-created_at">Más recientes</option>
              <option value="created_at">Más antiguos</option>
            </select>
          </label>
        </div>

        <div
          id="catalog-filter-drawer"
          class="catalog-filter-drawer"
          [class.is-open]="mobileFiltersOpen()"
        >
          <header class="filter-drawer-heading">
            <div>
              <h2>Filtrar prendas</h2>
              <p>Afina el catálogo sin perder de vista los productos.</p>
            </div>
            <button
              #drawerCloseButton
              type="button"
              class="button button--quiet"
              (click)="closeMobileFilters()"
            >
              Cerrar
            </button>
          </header>

          <div class="primary-filter-row">
            <div class="field field--compact">
              <label for="category-filter">Categoría</label
              ><select
                id="category-filter"
                formControlName="categoria"
                (change)="onCategoryChange()"
              >
                <option value="">Todas</option>
                @for (item of options().categories; track item.id_categoria) {
                  <option [value]="item.nombre">{{ item.nombre }}</option>
                }
              </select>
            </div>
            <div class="field field--compact">
              <label for="audience-filter">Público</label
              ><select id="audience-filter" formControlName="publico_objetivo">
                <option value="">Todos</option>
                <option value="HOMBRE" [disabled]="form.controls.categoria.value === 'BLUSA'">
                  Hombre
                </option>
                <option value="MUJER">Mujer</option>
              </select>
            </div>
            <div class="field field--compact">
              <label for="brand-filter">Marca</label
              ><select id="brand-filter" formControlName="marca">
                <option value="">Todas</option>
                @for (item of options().brands; track item.id_marca) {
                  <option [value]="item.nombre">{{ item.nombre }}</option>
                }
              </select>
            </div>
            <div class="field field--compact">
              <label for="size-filter">Talla</label
              ><select id="size-filter" formControlName="talla">
                <option value="">Todas</option>
                @for (item of options().sizes; track item.id_talla) {
                  <option [value]="item.codigo">{{ item.codigo }}</option>
                }
              </select>
            </div>
          </div>

          <details class="more-filters" [open]="mobileFiltersOpen()">
            <summary>
              Más filtros
              @if (secondaryFilterCount() > 0) {
                <span>{{ secondaryFilterCount() }}</span>
              }
            </summary>
            <div class="more-filters__panel">
              <div class="field field--compact">
                <label for="color-filter">Color</label
                ><select id="color-filter" formControlName="color">
                  <option value="">Todos</option>
                  @for (item of options().colors; track item.id_color) {
                    <option [value]="item.nombre">{{ item.nombre }}</option>
                  }
                </select>
              </div>
              <div class="field field--compact">
                <label for="season-filter">Temporada</label
                ><select id="season-filter" formControlName="temporada">
                  <option value="">Todas</option>
                  @for (item of options().seasons; track item.id_temporada) {
                    <option [value]="item.nombre">
                      {{ item.nombre }}{{ item.anio ? ' ' + item.anio : '' }}
                    </option>
                  }
                </select>
              </div>
              <div class="field field--compact">
                <label for="fitting-filter">Vestidor habilitado</label
                ><select id="fitting-filter" formControlName="permite_vestidor">
                  <option value="">Todos</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div class="field field--compact">
                <label for="status-filter">Estado</label
                ><select id="status-filter" formControlName="activo">
                  <option value="true">Solo activos</option>
                  <option value="">Todos</option>
                  <option value="false">Inactivos</option>
                </select>
              </div>
            </div>
          </details>

          <div class="filter-actions">
            <button class="button button--primary" type="submit">Aplicar</button
            ><button class="button button--quiet" type="button" (click)="clearFilters()">
              Limpiar filtros
            </button>
          </div>
        </div>
      </form>

      @if (mobileFiltersOpen()) {
        <button
          type="button"
          class="filter-backdrop"
          aria-label="Cerrar filtros"
          (click)="closeMobileFilters()"
        ></button>
      }

      @if (optionsError()) {
        <p class="inline-message" role="status">
          Algunos filtros no están disponibles: {{ optionsError() }}
        </p>
      }
      @if (loading()) {
        <div class="product-grid catalog-grid" aria-label="Cargando catálogo">
          @for (item of skeletons; track item) {
            <div class="product-skeleton"><span></span><i></i><i></i></div>
          }
        </div>
      } @else if (errorMessage()) {
        <app-status-panel
          kind="error"
          title="No pudimos cargar el catálogo"
          [message]="errorMessage()"
          (retry)="loadProducts(currentPage())"
        />
      } @else if (page().items.length === 0) {
        <app-status-panel
          title="No hay prendas con estos filtros"
          message="Prueba quitando uno o más filtros para ampliar la búsqueda."
        />
      } @else {
        <div class="product-grid catalog-grid">
          @for (product of page().items; track product.id_producto) {
            <app-product-card [product]="product" />
          }
        </div>
        <nav class="pagination" aria-label="Paginación del catálogo">
          <button
            type="button"
            class="button button--secondary"
            [disabled]="page().page <= 1"
            (click)="changePage(page().page - 1)"
          >
            Anterior
          </button>
          <span>Página {{ page().page }} de {{ page().pages }}</span>
          <button
            type="button"
            class="button button--secondary"
            [disabled]="page().page >= page().pages"
            (click)="changePage(page().page + 1)"
          >
            Siguiente
          </button>
        </nav>
      }
    </section>
  `,
})
export class Catalog {
  private readonly fb = inject(FormBuilder);
  private readonly catalog = inject(CatalogService);
  private readonly errors = inject(ApiErrorService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly mobileFilterTrigger =
    viewChild<ElementRef<HTMLButtonElement>>('mobileFilterTrigger');
  private readonly drawerCloseButton =
    viewChild<ElementRef<HTMLButtonElement>>('drawerCloseButton');
  readonly page = signal<ProductPage>(EMPTY_PAGE);
  readonly options = signal<CatalogOptions>(EMPTY_OPTIONS);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly optionsError = signal('');
  readonly currentPage = signal(1);
  readonly mobileFiltersOpen = signal(false);
  readonly skeletons = Array.from({ length: 8 }, (_, index) => index);
  private readonly query = this.route.snapshot.queryParamMap;
  readonly form = this.fb.nonNullable.group({
    categoria: [this.query.get('categoria') ?? ''],
    publico_objetivo: [this.query.get('publico_objetivo') ?? ''],
    marca: [this.query.get('marca') ?? ''],
    talla: [this.query.get('talla') ?? ''],
    color: [this.query.get('color') ?? ''],
    temporada: [this.query.get('temporada') ?? ''],
    permite_vestidor: [this.query.get('permite_vestidor') ?? ''],
    activo: [this.query.get('activo') ?? 'true'],
    sort: [this.query.get('sort') ?? 'nombre'],
  });

  constructor() {
    this.normalizeCategoryAudience();
    this.loadOptions();
    this.loadProducts(Number(this.query.get('page') ?? 1));
  }

  applyFilters(): void {
    this.normalizeCategoryAudience();
    this.closeMobileFilters();
    this.currentPage.set(1);
    this.syncUrl(1);
    this.loadProducts(1);
  }
  applySort(): void {
    this.applyFilters();
  }
  openMobileFilters(): void {
    this.mobileFiltersOpen.set(true);
    setTimeout(() => this.drawerCloseButton()?.nativeElement.focus());
  }
  closeMobileFilters(): void {
    if (!this.mobileFiltersOpen()) return;
    this.mobileFiltersOpen.set(false);
    setTimeout(() => this.mobileFilterTrigger()?.nativeElement.focus());
  }
  @HostListener('window:keydown.escape')
  closeFiltersOnEscape(): void {
    this.closeMobileFilters();
  }
  secondaryFilterCount(): number {
    const value = this.form.getRawValue();
    return [value.color, value.temporada, value.permite_vestidor, value.activo !== 'true'].filter(
      Boolean,
    ).length;
  }
  activeFilterCount(): number {
    const value = this.form.getRawValue();
    return [
      value.categoria,
      value.publico_objetivo,
      value.marca,
      value.talla,
      value.color,
      value.temporada,
      value.permite_vestidor,
      value.activo !== 'true',
    ].filter(Boolean).length;
  }
  onCategoryChange(): void {
    this.normalizeCategoryAudience();
  }
  clearFilters(): void {
    this.form.reset({
      categoria: '',
      publico_objetivo: '',
      marca: '',
      talla: '',
      color: '',
      temporada: '',
      permite_vestidor: '',
      activo: 'true',
      sort: 'nombre',
    });
    this.applyFilters();
  }
  changePage(page: number): void {
    this.currentPage.set(page);
    this.syncUrl(page);
    this.loadProducts(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  loadProducts(page: number): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.currentPage.set(page);
    this.catalog
      .products(this.filters(page))
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => this.page.set(result),
        error: (error) =>
          this.errorMessage.set(
            this.errors.message(error, 'El catálogo no está disponible en este momento.'),
          ),
      });
  }

  private loadOptions(): void {
    this.catalog.options().subscribe({
      next: (result) => this.options.set(result),
      error: (error) => this.optionsError.set(this.errors.message(error)),
    });
  }

  private filters(page: number): CatalogFilters {
    const value = this.form.getRawValue();
    const audience =
      value.categoria === 'BLUSA' && value.publico_objetivo === 'HOMBRE'
        ? 'MUJER'
        : value.publico_objetivo;
    return {
      categoria: value.categoria || undefined,
      publico_objetivo: (audience || undefined) as TargetAudience | undefined,
      marca: value.marca || undefined,
      talla: value.talla || undefined,
      color: value.color || undefined,
      temporada: value.temporada || undefined,
      permite_vestidor:
        value.permite_vestidor === '' ? undefined : value.permite_vestidor === 'true',
      activo: value.activo === '' ? undefined : value.activo === 'true',
      sort: value.sort as ProductSort,
      page,
      page_size: 12,
    };
  }

  private normalizeCategoryAudience(): void {
    if (
      this.form.controls.categoria.value === 'BLUSA' &&
      this.form.controls.publico_objetivo.value === 'HOMBRE'
    ) {
      this.form.controls.publico_objetivo.setValue('MUJER');
    }
  }

  private syncUrl(page: number): void {
    const filters = this.filters(page);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filters,
      replaceUrl: true,
    });
  }
}
