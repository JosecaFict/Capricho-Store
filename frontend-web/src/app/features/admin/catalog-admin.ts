import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PermissionService } from '../../core/permissions/permission.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AdminApiService, Entity } from './admin-api.service';

const MASTER: any = {
  categories: {
    label: 'Categorías',
    id: 'id_categoria',
    fields: [
      ['nombre', 'Nombre', 'text'],
      ['descripcion', 'Descripción', 'text'],
      ['activo', 'Activo', 'checkbox'],
    ],
  },
  brands: {
    label: 'Marcas',
    id: 'id_marca',
    fields: [
      ['nombre', 'Nombre', 'text'],
      ['descripcion', 'Descripción', 'text'],
      ['pais_origen', 'País de origen', 'text'],
      ['activo', 'Activo', 'checkbox'],
    ],
  },
  sizes: {
    label: 'Tallas',
    id: 'id_talla',
    display: 'codigo',
    detail: 'orden',
    readonly: true,
    fields: [],
  },
  colors: {
    label: 'Colores',
    id: 'id_color',
    fields: [
      ['nombre', 'Nombre', 'text'],
      ['codigo_hex', 'Código hexadecimal', 'color'],
      ['activo', 'Activo', 'checkbox'],
    ],
  },
  seasons: {
    label: 'Temporadas',
    id: 'id_temporada',
    fields: [
      ['nombre', 'Nombre', 'text'],
      ['anio', 'Año', 'number'],
      ['fecha_inicio', 'Inicio', 'date'],
      ['fecha_fin', 'Fin', 'date'],
      ['activo', 'Activo', 'checkbox'],
    ],
  },
  collections: {
    label: 'Colecciones',
    id: 'id_coleccion',
    fields: [
      ['nombre', 'Nombre', 'text'],
      ['id_temporada', 'ID temporada', 'number'],
      ['descripcion', 'Descripción', 'text'],
      ['activo', 'Activo', 'checkbox'],
    ],
  },
};

@Component({
  selector: 'app-master-data',
  imports: [CommonModule, ReactiveFormsModule],
  template: `<div class="admin-page">
    <header class="admin-page-heading">
      <div>
        <p class="eyebrow">Catálogo</p>
        <h1>Datos maestros</h1>
        <p>Categorías oficiales, tallas, marcas, colores, temporadas y colecciones.</p>
      </div>
    </header>
    <div class="admin-tabs" role="tablist">
      @for (k of keys; track k) {
        <button [class.active]="active() === k" (click)="select(k)">{{ cfg(k).label }}</button>
      }
    </div>
    @if (message()) {
      <div class="notice" [class.notice--error]="error()">{{ message() }}</div>
    }
    @if (cfg(active()).readonly) {
      <div class="notice">
        Las tallas S, M, L y XL son datos canónicos del Ciclo I y se administran como valores de
        solo lectura para proteger las variantes existentes.
      </div>
    } @else {
      <section class="admin-editor">
        <header>
          <h2>{{ editing() ? 'Editar' : 'Nuevo' }} · {{ cfg(active()).label }}</h2>
        </header>
        <form [formGroup]="form" (ngSubmit)="save()" class="admin-form-grid">
          @for (f of cfg(active()).fields; track f[0]) {
            <label class="field"
              ><span>{{ f[1] }}</span>
              @if (f[2] === 'checkbox') {
                <input type="checkbox" [formControlName]="f[0]" />
              } @else {
                <input [type]="f[2]" [formControlName]="f[0]" />
              }
            </label>
          }
          <div class="admin-form-actions">
            <button class="button button--primary" [disabled]="form.invalid">Guardar</button>
            @if (editing()) {
              <button type="button" class="button button--quiet" (click)="reset()">Cancelar</button>
            }
          </div>
        </form>
      </section>
    }
    <div class="admin-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Detalle</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          @for (x of items(); track x[cfg(active()).id]) {
            <tr>
              <td>
                <strong>{{ x[cfg(active()).display || 'nombre'] }}</strong>
              </td>
              <td>
                {{
                  (cfg(active()).detail ? x[cfg(active()).detail] : null) ||
                    x['descripcion'] ||
                    x['pais_origen'] ||
                    x['codigo_hex'] ||
                    x['anio'] ||
                    '—'
                }}
              </td>
              <td>{{ x['activo'] ? 'ACTIVO' : 'INACTIVO' }}</td>
              <td class="admin-row-actions">
                @if (canEdit() && !cfg(active()).readonly) {
                  <button (click)="edit(x)">Editar</button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="4">Sin registros.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  </div>`,
})
export class MasterDataAdmin implements OnInit {
  private api = inject(AdminApiService);
  private fb = inject(FormBuilder);
  private errs = inject(ApiErrorService);
  private perms = inject(PermissionService);
  keys = Object.keys(MASTER);
  active = signal('categories');
  items = signal<Entity[]>([]);
  editing = signal<number | null>(null);
  message = signal('');
  error = signal(false);
  canEdit = () => this.perms.hasAny(['productos.crear', 'productos.editar']);
  form = this.fb.group({
    nombre: ['', Validators.required],
    descripcion: [''],
    pais_origen: [''],
    codigo_hex: ['#000000'],
    anio: [null as number | null],
    fecha_inicio: [''],
    fecha_fin: [''],
    id_temporada: [null as number | null],
    activo: [true],
  });
  ngOnInit() {
    this.load();
  }
  cfg(k: string) {
    return MASTER[k];
  }
  select(k: string) {
    this.active.set(k);
    this.reset();
    this.load();
  }
  load() {
    this.api
      .list(this.active())
      .subscribe({ next: (v) => this.items.set(v), error: (e) => this.fail(e) });
  }
  reset() {
    this.editing.set(null);
    this.form.reset({ activo: true, codigo_hex: '#000000' });
  }
  edit(x: Entity) {
    this.editing.set(x[this.cfg(this.active()).id]);
    this.form.patchValue(x as any);
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  save() {
    if (this.cfg(this.active()).readonly) return;
    const allowed = this.cfg(this.active()).fields.map((x: any) => x[0]);
    const raw = this.form.getRawValue() as Entity;
    const payload = Object.fromEntries(
      Object.entries(raw).filter(([k, v]) => allowed.includes(k) && v !== '' && v !== null),
    );
    const req = this.editing()
      ? this.api.patch(`${this.active()}/${this.editing()}`, payload)
      : this.api.post(this.active(), payload);
    req.subscribe({
      next: () => {
        this.reset();
        this.load();
        this.message.set('Registro guardado.');
        this.error.set(false);
      },
      error: (e) => this.fail(e),
    });
  }
  fail(e: unknown) {
    this.error.set(true);
    this.message.set(this.errs.message(e));
  }
}

@Component({
  selector: 'app-products-admin',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `<div class="admin-page">
    <header class="admin-page-heading">
      <div>
        <p class="eyebrow">Catálogo</p>
        <h1>Productos</h1>
        <p>Precio, público, variantes y disponibilidad editorial.</p>
      </div>
      @if (canCreate()) {
        <button class="button button--primary" (click)="open()">Nuevo producto</button>
      }
    </header>
    @if (message()) {
      <div class="notice notice--error">{{ message() }}</div>
    }
    @if (show()) {
      <section class="admin-editor">
        <header>
          <h2>{{ editing() ? 'Editar' : 'Crear' }} producto</h2>
          <button class="button button--quiet" (click)="show.set(false)">Cerrar</button>
        </header>
        <form [formGroup]="form" (ngSubmit)="save()" class="admin-form-grid">
          <label class="field"><span>Nombre</span><input formControlName="nombre" /></label
          ><label class="field"
            ><span>Categoría</span
            ><select formControlName="id_categoria" (change)="enforceAudience()">
              <option value="">Seleccionar</option>
              @for (c of categories(); track c['id_categoria']) {
                <option [value]="c['id_categoria']">{{ c['nombre'] }}</option>
              }
            </select></label
          ><label class="field"
            ><span>Marca</span
            ><select formControlName="id_marca">
              <option value="">Seleccionar</option>
              @for (m of brands(); track m['id_marca']) {
                <option [value]="m['id_marca']">{{ m['nombre'] }}</option>
              }
            </select></label
          ><label class="field"
            ><span>Público</span
            ><select formControlName="publico_objetivo">
              <option>HOMBRE</option>
              <option>MUJER</option>
            </select></label
          ><label class="field field--wide"
            ><span>Descripción</span
            ><textarea formControlName="descripcion" rows="3"></textarea></label
          ><label class="check-field"
            ><input type="checkbox" formControlName="permite_vestidor" /> Vestidor habilitado</label
          ><label class="check-field"
            ><input type="checkbox" formControlName="activo" /> Activo</label
          >
          <div class="admin-form-actions">
            <button class="button button--primary" [disabled]="form.invalid">
              Guardar producto
            </button>
          </div>
        </form>
      </section>
    }
    <div class="admin-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Categoría / público</th>
            <th>Precio</th>
            <th>Tallas</th>
            <th>Colores</th>
            <th>Variantes</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          @for (p of products(); track p['id_producto']) {
            <tr>
              <td>
                <strong>{{ p['nombre'] }}</strong
                ><small>{{ p['marca'] }}</small>
              </td>
              <td>{{ p['categoria'] }} · {{ p['publico_objetivo'] }}</td>
              <td>{{ p['precio_actual'] == null ? 'Sin precio' : 'Bs ' + p['precio_actual'] }}</td>
              <td>{{ uniqueCount(p['variantes'], 'id_talla') }}</td>
              <td>
                <span class="admin-color-summary">
                  @for (color of uniqueColors(p['variantes']); track color['id_color']) {
                    <i
                      [style.background]="color['codigo_hex'] || '#d8dadd'"
                      [title]="color['color']"
                    ></i>
                  }
                  <small>{{ uniqueCount(p['variantes'], 'id_color') }}</small>
                </span>
              </td>
              <td>{{ p['variantes']?.length || 0 }}</td>
              <td>{{ p['activo'] ? 'ACTIVO' : 'INACTIVO' }}</td>
              <td class="admin-row-actions">
                <a [routerLink]="['/admin/productos', p['id_producto']]">Gestionar</a>
                @if (canEdit()) {
                  <button (click)="edit(p)">Editar</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  </div>`,
})
export class ProductsAdmin implements OnInit {
  private api = inject(AdminApiService);
  private fb = inject(FormBuilder);
  private errs = inject(ApiErrorService);
  private perms = inject(PermissionService);
  products = signal<Entity[]>([]);
  categories = signal<Entity[]>([]);
  brands = signal<Entity[]>([]);
  show = signal(false);
  editing = signal<number | null>(null);
  message = signal('');
  canCreate = () => this.perms.has('productos.crear');
  canEdit = () => this.perms.has('productos.editar');
  form = this.fb.group({
    id_categoria: [null as number | null, Validators.required],
    id_marca: [null as number | null, Validators.required],
    nombre: ['', Validators.required],
    descripcion: [''],
    publico_objetivo: ['MUJER', Validators.required],
    permite_vestidor: [true],
    activo: [true],
  });
  ngOnInit() {
    forkJoin({
      categories: this.api.list('categories'),
      brands: this.api.list('brands'),
    }).subscribe((v) => {
      this.categories.set(v.categories);
      this.brands.set(v.brands);
    });
    this.load();
  }
  load() {
    this.api.products({ activo: undefined, page_size: 100 }).subscribe({
      next: (v) => this.products.set(v.items),
      error: (e) => this.message.set(this.errs.message(e)),
    });
  }
  open() {
    this.editing.set(null);
    this.form.reset({ publico_objetivo: 'MUJER', permite_vestidor: true, activo: true });
    this.show.set(true);
  }
  edit(p: Entity) {
    this.editing.set(p['id_producto']);
    this.form.patchValue(p as any);
    this.show.set(true);
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  enforceAudience() {
    const c = this.categories().find((x) => x['id_categoria'] == this.form.value.id_categoria);
    if (c?.['nombre'] === 'BLUSA') this.form.controls.publico_objetivo.setValue('MUJER');
  }
  save() {
    this.enforceAudience();
    const req = this.editing()
      ? this.api.patch(`products/${this.editing()}`, this.form.getRawValue())
      : this.api.post('products', this.form.getRawValue());
    req.subscribe({
      next: () => {
        this.show.set(false);
        this.load();
      },
      error: (e) => this.message.set(this.errs.message(e)),
    });
  }
  uniqueCount(items: Entity[] | undefined, key: string): number {
    return new Set((items || []).map((item) => item[key])).size;
  }
  uniqueColors(items: Entity[] | undefined): Entity[] {
    return (items || []).filter(
      (item, index, all) =>
        all.findIndex((other) => other['id_color'] === item['id_color']) === index,
    );
  }
}

@Component({
  selector: 'app-product-admin-detail',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `<div class="admin-page">
    <a class="back-link" routerLink="/admin/productos">← Productos</a>
    @if (product(); as p) {
      <header class="admin-page-heading">
        <div>
          <p class="eyebrow">{{ p['categoria'] }} · {{ p['publico_objetivo'] }}</p>
          <h1>{{ p['nombre'] }}</h1>
          <p>{{ p['marca'] }} · {{ p['activo'] ? 'Activo' : 'Inactivo' }}</p>
        </div>
        <strong class="admin-price">{{
          p['precio_actual'] == null ? 'Sin precio' : 'Bs ' + p['precio_actual']
        }}</strong>
      </header>
      <div class="admin-detail-grid">
        <section class="admin-panel">
          <h2>Precio</h2>
          <form [formGroup]="priceForm" (ngSubmit)="setPrice()" class="admin-inline-form">
            <label class="field"
              ><span>Nuevo precio</span
              ><input type="number" min="0" step=".01" formControlName="precio" /></label
            ><button class="button button--primary" [disabled]="!canEdit()">Actualizar</button>
          </form>
          <div class="admin-timeline">
            @for (x of prices(); track x['id_historial_precio']) {
              <p>
                <strong>Bs {{ x['precio'] }}</strong
                ><small
                  >{{ x['fecha_inicio'] | date: 'medium' }}
                  {{ x['fecha_fin'] ? '— cerrado' : '— actual' }}</small
                >
              </p>
            }
          </div>
        </section>
        <section class="admin-panel admin-panel--variants">
          <h2>Variantes por color</h2>
          <p class="admin-help">
            Elige un color, marca las tallas disponibles y crea todas sus combinaciones. El stock se
            registra después, por sucursal, mediante recepciones de compra.
          </p>
          <form [formGroup]="variantForm" (ngSubmit)="addVariants()" class="variant-builder">
            <div class="variant-builder__controls">
              <label class="field"
                ><span>Color</span
                ><select formControlName="id_color" (change)="prepareColor()">
                  <option value="">Seleccionar color</option>
                  @for (c of colors(); track c['id_color']) {
                    <option [value]="c['id_color']">{{ c['nombre'] }}</option>
                  }
                </select></label
              ><label class="field"
                ><span>Prefijo SKU del color</span
                ><input formControlName="sku_base" placeholder="RL-POLO-CF-AZM"
              /></label>
            </div>
            @if (variantForm.value.id_color) {
              <div class="variant-matrix" role="group" aria-label="Tallas para el color elegido">
                @for (s of sizes(); track s['id_talla']) {
                  @if (variantFor(s['id_talla']); as existing) {
                    <div class="variant-matrix__row is-existing">
                      <span class="variant-size">{{ s['codigo'] }}</span>
                      <span
                        ><strong>{{ existing['sku'] }}</strong
                        ><small>Variante existente</small></span
                      >
                      <span class="status-chip" [class.status-chip--muted]="!existing['activo']">
                        {{ existing['activo'] ? 'Activa' : 'Inactiva' }}
                      </span>
                      @if (canEdit()) {
                        <button
                          type="button"
                          class="button button--quiet"
                          (click)="toggleVariant(existing)"
                        >
                          {{ existing['activo'] ? 'Desactivar' : 'Reactivar' }}
                        </button>
                      }
                    </div>
                  } @else {
                    <label class="variant-matrix__row">
                      <input
                        type="checkbox"
                        [checked]="isSizeSelected(s['id_talla'])"
                        (change)="toggleSize(s['id_talla'])"
                      />
                      <span class="variant-size">{{ s['codigo'] }}</span>
                      <span
                        ><strong>{{ proposedSku(s['codigo']) }}</strong
                        ><small>Nueva variante</small></span
                      >
                    </label>
                  }
                }
              </div>
              <div class="variant-builder__footer">
                <p>El código de barras es opcional y puede incorporarse cuando esté disponible.</p>
                <button
                  class="button button--secondary"
                  [disabled]="
                    !canCreate() ||
                    variantForm.invalid ||
                    selectedSizeIds().length === 0 ||
                    savingVariants()
                  "
                >
                  {{ savingVariants() ? 'Creando...' : 'Crear variantes seleccionadas' }}
                </button>
              </div>
            }
          </form>
          <div class="product-color-tabs" aria-label="Colores configurados">
            @for (color of productColors(); track color['id_color']) {
              <button type="button" (click)="chooseColor(color['id_color'])">
                <i [style.background]="color['codigo_hex'] || '#d8dadd'"></i>
                {{ color['color'] }}
                <small>{{ color['sizes'].length }} tallas</small>
              </button>
            } @empty {
              <p class="admin-empty">Aún no hay colores configurados.</p>
            }
          </div>
        </section>
      </div>
      <section class="admin-panel">
        <h2>Imágenes y medidas</h2>
        <p class="admin-help">
          Sube una imagen JPG, PNG o WebP de hasta 5 MB. Se almacenará en Cloudinary.
        </p>
        <form [formGroup]="imageForm" (ngSubmit)="addImage()" class="admin-form-grid">
          <label class="field field--wide"
            ><span>Archivo de imagen</span
            ><input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              (change)="selectImage($event)"
              required
          /></label>
          @if (imagePreview()) {
            <figure class="admin-image-preview field--wide">
              <img
                [src]="imagePreview()"
                alt="Vista previa de la imagen seleccionada"
                (error)="handleImageError($event, true)"
              />
              <figcaption>{{ selectedImage()?.name }}</figcaption>
            </figure>
          }
          <label class="field"
            ><span>Tipo</span
            ><select formControlName="tipo">
              <option>CATALOGO</option>
              <option>MINIATURA</option>
              <option>PROMOCIONAL</option>
            </select></label
          ><label class="field"
            ><span>Color de la prenda</span
            ><select formControlName="id_color">
              <option value="">Seleccionar color</option>
              @for (c of productColors(); track c['id_color']) {
                @if (c['active']) {
                  <option [value]="c['id_color']">{{ c['color'] }}</option>
                }
              }
            </select></label
          ><label class="field"
            ><span>Orden</span><input type="number" min="1" formControlName="orden" /></label
          ><label class="check-field"
            ><input type="checkbox" formControlName="es_principal" /> Principal</label
          ><button
            class="button button--secondary"
            [disabled]="!canEdit() || imageForm.invalid || !selectedImage() || uploadingImage()"
          >
            {{ uploadingImage() ? 'Subiendo...' : 'Subir imagen' }}
          </button>
        </form>
        <div class="admin-image-list">
          @for (i of images(); track i['id_imagen']) {
            <span>
              <img
                [src]="i['secure_url']"
                [alt]="'Imagen ' + i['tipo'] + ' del producto'"
                (error)="handleImageError($event)"
              />
              <a [href]="i['secure_url']" target="_blank" rel="noopener">{{ i['tipo'] }}</a>
              <small>{{ colorName(i['id_color']) }}</small>
              @if (canEdit()) {
                <button class="button button--quiet" (click)="toggleImage(i)">
                  {{ i['es_principal'] ? 'Quitar principal' : 'Marcar principal' }}
                </button>
              }</span
            >
          }
        </div>
      </section>
      <div class="admin-detail-grid">
        <section class="admin-panel">
          <h2>Medidas por talla</h2>
          <form
            [formGroup]="measurementForm"
            (ngSubmit)="saveMeasurement()"
            class="admin-form-grid admin-form-grid--two"
          >
            <label class="field"
              ><span>Talla</span
              ><select formControlName="id_talla">
                @for (s of sizes(); track s['id_talla']) {
                  <option [value]="s['id_talla']">{{ s['codigo'] }}</option>
                }
              </select></label
            >
            <label class="field"
              ><span>Hombros (cm)</span
              ><input type="number" step=".01" formControlName="ancho_hombros_cm"
            /></label>
            <label class="field"
              ><span>Pecho (cm)</span
              ><input type="number" step=".01" formControlName="ancho_pecho_cm"
            /></label>
            <label class="field"
              ><span>Largo (cm)</span
              ><input type="number" step=".01" formControlName="largo_prenda_cm"
            /></label>
            <label class="field"
              ><span>Manga (cm)</span
              ><input type="number" step=".01" formControlName="largo_manga_cm"
            /></label>
            <button class="button button--secondary" [disabled]="!canEdit()">
              Guardar medidas
            </button>
          </form>
          <div class="permission-list">
            @for (m of measurements(); track m['id_medida']) {
              <div>
                <strong>{{ m['talla'] }}</strong
                ><span
                  >{{ m['ancho_pecho_cm'] || '—' }} cm pecho · {{ m['largo_prenda_cm'] || '—' }} cm
                  largo</span
                >
              </div>
            }
          </div>
        </section>
        <section class="admin-panel">
          <h2>Temporadas y colecciones</h2>
          <form [formGroup]="relationForm" class="admin-inline-form">
            <label class="field"
              ><span>Temporada</span
              ><select formControlName="id_temporada">
                <option value="">Seleccionar</option>
                @for (s of seasons(); track s['id_temporada']) {
                  <option [value]="s['id_temporada']">{{ s['nombre'] }}</option>
                }
              </select></label
            ><button
              type="button"
              class="button button--secondary"
              [disabled]="!canEdit()"
              (click)="addSeason()"
            >
              Asociar
            </button>
          </form>
          <div class="admin-lot-trace">
            @for (s of productSeasons(); track s['id_temporada']) {
              <span
                >{{ s['nombre'] }}
                @if (canEdit()) {
                  <button (click)="removeSeason(s['id_temporada'])" aria-label="Quitar temporada">
                    ×
                  </button>
                }</span
              >
            }
          </div>
          <form [formGroup]="relationForm" class="admin-inline-form">
            <label class="field"
              ><span>Colección</span
              ><select formControlName="id_coleccion">
                <option value="">Seleccionar</option>
                @for (c of collections(); track c['id_coleccion']) {
                  <option [value]="c['id_coleccion']">{{ c['nombre'] }}</option>
                }
              </select></label
            ><button
              type="button"
              class="button button--secondary"
              [disabled]="!canEdit()"
              (click)="addCollection()"
            >
              Asociar
            </button>
          </form>
          <div class="admin-lot-trace">
            @for (c of productCollections(); track c['id_coleccion']) {
              <span
                >{{ c['nombre'] }}
                @if (canEdit()) {
                  <button
                    (click)="removeCollection(c['id_coleccion'])"
                    aria-label="Quitar colección"
                  >
                    ×
                  </button>
                }</span
              >
            }
          </div>
        </section>
      </div>
    } @else {
      <div class="admin-skeleton"></div>
    }
    @if (message()) {
      <div class="notice" [class.notice--error]="error()">{{ message() }}</div>
    }
  </div>`,
})
export class ProductAdminDetail implements OnInit {
  private api = inject(AdminApiService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private errs = inject(ApiErrorService);
  private perms = inject(PermissionService);
  id = Number(this.route.snapshot.paramMap.get('id'));
  product = signal<Entity | null>(null);
  prices = signal<Entity[]>([]);
  images = signal<Entity[]>([]);
  sizes = signal<Entity[]>([]);
  colors = signal<Entity[]>([]);
  measurements = signal<Entity[]>([]);
  seasons = signal<Entity[]>([]);
  collections = signal<Entity[]>([]);
  productSeasons = signal<Entity[]>([]);
  productCollections = signal<Entity[]>([]);
  selectedImage = signal<File | null>(null);
  imagePreview = signal<string | null>(null);
  uploadingImage = signal(false);
  savingVariants = signal(false);
  selectedSizeIds = signal<number[]>([]);
  message = signal('');
  error = signal(false);
  canCreate = () => this.perms.has('productos.crear');
  canEdit = () => this.perms.has('productos.editar');
  priceForm = this.fb.group({
    precio: [null as number | null, [Validators.required, Validators.min(0)]],
  });
  variantForm = this.fb.group({
    id_color: [null as number | null, Validators.required],
    sku_base: ['', Validators.required],
  });
  imageForm = this.fb.group({
    id_color: [null as number | null, Validators.required],
    tipo: ['CATALOGO'],
    orden: [1, [Validators.required, Validators.min(1)]],
    es_principal: [false],
  });
  measurementForm = this.fb.group({
    id_talla: [null as number | null, Validators.required],
    ancho_hombros_cm: [null as number | null],
    ancho_pecho_cm: [null as number | null],
    largo_prenda_cm: [null as number | null],
    largo_manga_cm: [null as number | null],
  });
  relationForm = this.fb.group({
    id_temporada: [null as number | null],
    id_coleccion: [null as number | null],
  });
  productColors = computed(() => {
    const variants = (this.product()?.['variantes'] || []) as Entity[];
    const groups = new Map<number, Entity>();
    for (const variant of variants) {
      const id = Number(variant['id_color']);
      const current = groups.get(id);
      if (current) {
        current['sizes'] = [...(current['sizes'] as string[]), variant['talla']];
        current['active'] = Boolean(current['active'] || variant['activo']);
      } else {
        groups.set(id, {
          id_color: id,
          color: variant['color'],
          codigo_hex: variant['codigo_hex'],
          sizes: [variant['talla']],
          active: Boolean(variant['activo']),
        });
      }
    }
    return [...groups.values()];
  });
  ngOnInit() {
    this.load();
  }
  load() {
    forkJoin({
      product: this.api.get(`products/${this.id}`),
      variants: this.api.list(`products/${this.id}/variants`),
      prices: this.api.list(`products/${this.id}/price-history`),
      images: this.api.list(`products/${this.id}/images`),
      sizes: this.api.list('sizes'),
      colors: this.api.list('colors'),
      measurements: this.api.list(`products/${this.id}/measurements`),
      seasons: this.api.list('seasons'),
      collections: this.api.list('collections'),
      productSeasons: this.api.list(`products/${this.id}/seasons`),
      productCollections: this.api.list(`products/${this.id}/collections`),
    }).subscribe({
      next: (v) => {
        this.product.set({ ...v.product, variantes: v.variants });
        this.prices.set(v.prices);
        this.images.set(v.images);
        this.sizes.set(v.sizes);
        this.colors.set(v.colors);
        this.measurements.set(v.measurements);
        this.seasons.set(v.seasons);
        this.collections.set(v.collections);
        this.productSeasons.set(v.productSeasons);
        this.productCollections.set(v.productCollections);
      },
      error: (e) => this.fail(e),
    });
  }
  setPrice() {
    if (!this.canEdit()) return;
    this.api.post(`products/${this.id}/price`, this.priceForm.getRawValue()).subscribe({
      next: () => {
        this.ok('Precio actualizado.');
        this.load();
      },
      error: (e) => this.fail(e),
    });
  }
  prepareColor() {
    const colorId = Number(this.variantForm.value.id_color);
    const missing = this.sizes()
      .filter((size) => !this.variantFor(size['id_talla']))
      .map((size) => Number(size['id_talla']));
    this.selectedSizeIds.set(colorId ? missing : []);
    const color = this.colors().find((item) => Number(item['id_color']) === colorId);
    this.variantForm.controls.sku_base.setValue(this.skuBase(color?.['nombre'] || ''));
  }
  chooseColor(colorId: number) {
    this.variantForm.controls.id_color.setValue(colorId);
    this.prepareColor();
  }
  variantFor(sizeId: number): Entity | undefined {
    const colorId = Number(this.variantForm.value.id_color);
    return ((this.product()?.['variantes'] || []) as Entity[]).find(
      (variant) =>
        Number(variant['id_color']) === colorId && Number(variant['id_talla']) === Number(sizeId),
    );
  }
  toggleSize(sizeId: number) {
    this.selectedSizeIds.update((ids) =>
      ids.includes(Number(sizeId))
        ? ids.filter((id) => id !== Number(sizeId))
        : [...ids, Number(sizeId)],
    );
  }
  isSizeSelected(sizeId: number): boolean {
    return this.selectedSizeIds().includes(Number(sizeId));
  }
  proposedSku(sizeCode: string): string {
    const base = (this.variantForm.value.sku_base || '').trim().replace(/-+$/, '');
    return base ? `${base}-${sizeCode}` : sizeCode;
  }
  addVariants() {
    if (!this.canCreate()) return;
    if (this.variantForm.invalid || this.selectedSizeIds().length === 0) return;
    const colorId = Number(this.variantForm.value.id_color);
    const sizeIds = this.selectedSizeIds();
    this.savingVariants.set(true);
    this.api
      .post(`products/${this.id}/variants/batch`, {
        id_color: colorId,
        id_tallas: sizeIds,
        sku_base: (this.variantForm.value.sku_base || '').trim(),
      })
      .subscribe({
        next: () => {
          this.savingVariants.set(false);
          this.ok(`${sizeIds.length} variante(s) creadas.`);
          this.selectedSizeIds.set([]);
          this.load();
        },
        error: (e) => {
          this.savingVariants.set(false);
          this.fail(e);
          this.load();
        },
      });
  }
  toggleVariant(variant: Entity) {
    if (!this.canEdit()) return;
    this.api.patch(`variants/${variant['id_variante']}`, { activo: !variant['activo'] }).subscribe({
      next: () => {
        this.ok(variant['activo'] ? 'Variante desactivada.' : 'Variante reactivada.');
        this.load();
      },
      error: (e) => this.fail(e),
    });
  }
  private skuBase(colorName: string): string {
    const code = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .split(/[^A-Z0-9]+/)
        .filter(Boolean)
        .map((part) => part.slice(0, 3))
        .join('-');
    return [code(String(this.product()?.['nombre'] || 'PROD')), code(colorName)]
      .filter(Boolean)
      .join('-');
  }
  selectImage(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    const previous = this.imagePreview();
    if (previous) URL.revokeObjectURL(previous);
    this.selectedImage.set(file);
    this.imagePreview.set(file ? URL.createObjectURL(file) : null);
  }
  handleImageError(event: Event, selectedFile = false) {
    (event.target as HTMLImageElement).hidden = true;
    if (selectedFile) {
      this.error.set(true);
      this.message.set('No se pudo obtener una vista previa. Selecciona otra imagen.');
    }
  }
  addImage() {
    if (!this.canEdit()) return;
    const file = this.selectedImage();
    if (!file || this.imageForm.invalid || this.uploadingImage()) return;
    const raw = this.imageForm.getRawValue();
    const payload = new FormData();
    payload.append('file', file);
    payload.append('tipo', raw.tipo || 'CATALOGO');
    payload.append('id_color', String(raw.id_color));
    payload.append('orden', String(raw.orden || 1));
    payload.append('es_principal', String(Boolean(raw.es_principal)));
    this.uploadingImage.set(true);
    this.api.postForm(`products/${this.id}/images/upload`, payload).subscribe({
      next: () => {
        this.uploadingImage.set(false);
        const preview = this.imagePreview();
        if (preview) URL.revokeObjectURL(preview);
        this.selectedImage.set(null);
        this.imagePreview.set(null);
        this.imageForm.reset({
          id_color: raw.id_color,
          tipo: 'CATALOGO',
          orden: 1,
          es_principal: false,
        });
        this.ok('Imagen subida correctamente.');
        this.load();
      },
      error: (e) => {
        this.uploadingImage.set(false);
        this.fail(e);
      },
    });
  }
  toggleImage(image: Entity) {
    if (!this.canEdit()) return;
    this.api
      .patch(`product-images/${image['id_imagen']}`, { es_principal: !image['es_principal'] })
      .subscribe({ next: () => this.load(), error: (e) => this.fail(e) });
  }
  colorName(colorId: number | null): string {
    if (!colorId) return 'Imagen general';
    return String(
      this.colors().find((color) => Number(color['id_color']) === Number(colorId))?.['nombre'] ||
        'Color',
    );
  }
  saveMeasurement() {
    if (!this.canEdit()) return;
    const { id_talla, ...payload } = this.measurementForm.getRawValue();
    this.api.put(`products/${this.id}/measurements/${id_talla}`, payload).subscribe({
      next: () => {
        this.ok('Medidas guardadas.');
        this.load();
      },
      error: (e) => this.fail(e),
    });
  }
  addSeason() {
    if (!this.canEdit()) return;
    const id = this.relationForm.value.id_temporada;
    if (!id) return;
    this.api
      .post(`products/${this.id}/seasons`, { id_temporada: id })
      .subscribe({ next: () => this.load(), error: (e) => this.fail(e) });
  }
  removeSeason(id: number) {
    if (!this.canEdit()) return;
    this.api
      .delete(`products/${this.id}/seasons/${id}`)
      .subscribe({ next: () => this.load(), error: (e) => this.fail(e) });
  }
  addCollection() {
    if (!this.canEdit()) return;
    const id = this.relationForm.value.id_coleccion;
    if (!id) return;
    this.api
      .post(`products/${this.id}/collections`, { id_coleccion: id })
      .subscribe({ next: () => this.load(), error: (e) => this.fail(e) });
  }
  removeCollection(id: number) {
    if (!this.canEdit()) return;
    this.api
      .delete(`products/${this.id}/collections/${id}`)
      .subscribe({ next: () => this.load(), error: (e) => this.fail(e) });
  }
  ok(m: string) {
    this.error.set(false);
    this.message.set(m);
  }
  fail(e: unknown) {
    this.error.set(true);
    this.message.set(this.errs.message(e));
  }
}
