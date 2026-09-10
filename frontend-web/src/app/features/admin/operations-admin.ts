import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiErrorService } from '../../core/services/api-error.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { AdminApiService, Entity } from './admin-api.service';

abstract class BaseAdmin {
  protected api = inject(AdminApiService);
  protected fb = inject(FormBuilder);
  protected errs = inject(ApiErrorService);
  message = signal('');
  error = signal(false);
  ok(m: string) {
    this.error.set(false);
    this.message.set(m);
  }
  fail(e: unknown) {
    this.error.set(true);
    this.message.set(this.errs.message(e));
  }
}

@Component({
  selector: 'app-suppliers-admin',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `<div class="admin-page">
    <header class="admin-page-heading">
      <div>
        <p class="eyebrow">Compras</p>
        <h1>Proveedores</h1>
        <p>Contactos comerciales y productos asociados.</p>
      </div>
      @if (canManage()) {
        <button class="button button--primary" (click)="open()">Nuevo proveedor</button>
      }
    </header>
    @if (message()) {
      <div class="notice" [class.notice--error]="error()">{{ message() }}</div>
    }
    @if (show()) {
      <section class="admin-editor">
        <header>
          <h2>{{ editing() ? 'Editar' : 'Crear' }} proveedor</h2>
          <button class="button button--quiet" (click)="show.set(false)">Cerrar</button>
        </header>
        <form [formGroup]="form" (ngSubmit)="save()" class="admin-form-grid">
          @for (f of fields; track f[0]) {
            <label class="field"
              ><span>{{ f[1] }}</span
              ><input [type]="f[2]" [formControlName]="f[0]"
            /></label>
          }
          <label class="check-field"
            ><input type="checkbox" formControlName="activo" /> Activo</label
          ><button class="button button--primary" [disabled]="form.invalid">Guardar</button>
        </form>
        <p class="admin-help">
          Usa la razón social legal para facturación. El nombre comercial puede corresponder a una
          marca directa o a un distribuidor multimarca.
        </p>
      </section>
    }
    <div class="admin-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>NIT</th>
            <th>Contacto</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          @for (s of items(); track s['id_proveedor']) {
            <tr>
              <td>
                <strong>{{ s['razon_social'] }}</strong
                ><small>{{ s['nombre_comercial'] || '—' }}</small>
              </td>
              <td>{{ s['nit'] || '—' }}</td>
              <td>{{ s['correo'] || s['telefono'] || '—' }}</td>
              <td>{{ s['activo'] ? 'ACTIVO' : 'INACTIVO' }}</td>
              <td class="admin-row-actions">
                <a [routerLink]="['/admin/proveedores', s['id_proveedor']]">Productos</a>
                @if (canManage()) {
                  <button (click)="edit(s)">Editar</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  </div>`,
})
export class SuppliersAdmin extends BaseAdmin implements OnInit {
  private perms = inject(PermissionService);
  items = signal<Entity[]>([]);
  show = signal(false);
  editing = signal<number | null>(null);
  canManage = () => this.perms.has('proveedores.gestionar');
  fields = [
    ['razon_social', 'Razón social', 'text'],
    ['nombre_comercial', 'Nombre comercial', 'text'],
    ['nit', 'NIT', 'text'],
    ['telefono', 'Teléfono', 'tel'],
    ['correo', 'Correo', 'email'],
    ['direccion', 'Dirección', 'text'],
    ['nombre_contacto', 'Nombre de contacto', 'text'],
    ['telefono_contacto', 'Teléfono contacto', 'tel'],
    ['correo_contacto', 'Correo contacto', 'email'],
  ] as const;
  form = this.fb.group({
    razon_social: ['', Validators.required],
    nombre_comercial: [''],
    nit: [''],
    telefono: [''],
    correo: [''],
    direccion: [''],
    nombre_contacto: [''],
    telefono_contacto: [''],
    correo_contacto: [''],
    activo: [true],
  });
  ngOnInit() {
    this.load();
  }
  load() {
    this.api
      .list('suppliers')
      .subscribe({ next: (v) => this.items.set(v), error: (e) => this.fail(e) });
  }
  open() {
    this.editing.set(null);
    this.form.reset({ activo: true });
    this.show.set(true);
  }
  edit(x: Entity) {
    this.editing.set(x['id_proveedor']);
    this.form.patchValue(x as any);
    this.show.set(true);
  }
  save() {
    const req = this.editing()
      ? this.api.patch(`suppliers/${this.editing()}`, this.form.getRawValue())
      : this.api.post('suppliers', this.form.getRawValue());
    req.subscribe({
      next: () => {
        this.show.set(false);
        this.load();
        this.ok('Proveedor guardado.');
      },
      error: (e) => this.fail(e),
    });
  }
}

@Component({
  selector: 'app-supplier-detail',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `<div class="admin-page">
    <a class="back-link" routerLink="/admin/proveedores">← Proveedores</a>
    @if (supplier(); as s) {
      <header class="admin-page-heading">
        <div>
          <h1>{{ s['razon_social'] }}</h1>
          <p>{{ s['nombre_comercial'] || 'Sin nombre comercial' }}</p>
        </div>
      </header>
      <section class="supplier-brand-summary" aria-labelledby="supplier-brands-title">
        <div>
          <h2 id="supplier-brands-title">Marcas distribuidas</h2>
          <p>Se calculan a partir de los productos asociados a este proveedor.</p>
        </div>
        <div class="supplier-brand-list">
          @for (brand of distributedBrands(); track brand) {
            <span>{{ brand }}</span>
          } @empty {
            <span class="is-empty">Sin marcas asociadas</span>
          }
        </div>
      </section>
      <section class="admin-panel">
        <h2>Productos asociados</h2>
        <p class="admin-help">
          Un distribuidor puede abastecer productos de varias marcas. Asocia cada producto que pueda
          incluirse en una orden de compra.
        </p>
        <form [formGroup]="form" (ngSubmit)="add()" class="admin-inline-form">
          <label class="field"
            ><span>Producto y marca</span
            ><select formControlName="id_producto">
              <option value="">Seleccionar producto</option>
              @for (product of availableProducts(); track product['id_producto']) {
                <option [value]="product['id_producto']">
                  {{ product['marca'] }} — {{ product['nombre'] }}
                </option>
              }
            </select></label
          ><label class="field"
            ><span>Código del proveedor</span><input formControlName="codigo_proveedor" /></label
          ><button class="button button--primary" [disabled]="!canManage() || form.invalid">
            Asociar producto
          </button>
        </form>
        @if (availableProducts().length === 0 && catalogProducts().length > 0) {
          <p class="admin-complete-state">Todos los productos disponibles ya están asociados.</p>
        }
        <div class="permission-list">
          @for (p of products(); track p['id_producto']) {
            <div>
              <span
                ><strong>{{ p['producto'] }}</strong
                ><small
                  >{{ productBrand(p['id_producto']) }} ·
                  {{ p['codigo_proveedor'] || 'Sin código externo' }}</small
                ></span
              >
              @if (canManage()) {
                @if (confirmRemoveProductId() === p['id_producto']) {
                  <span class="admin-row-actions">
                    <button class="button button--danger" (click)="remove(p['id_producto'])">
                      Confirmar
                    </button>
                    <button class="button button--quiet" (click)="confirmRemoveProductId.set(null)">
                      Cancelar
                    </button>
                  </span>
                } @else {
                  <button
                    class="button button--quiet button--danger-text"
                    (click)="confirmRemoveProductId.set(p['id_producto'])"
                  >
                    Quitar asociación
                  </button>
                }
              }
            </div>
          } @empty {
            <p class="admin-empty">No hay productos asociados todavía.</p>
          }
        </div>
        <p class="admin-help">
          Quitar solo elimina la relación proveedor–producto; no elimina ninguna entidad.
        </p>
      </section>
    }
    @if (message()) {
      <div class="notice" [class.notice--error]="error()">{{ message() }}</div>
    }
  </div>`,
})
export class SupplierDetail extends BaseAdmin implements OnInit {
  private route = inject(ActivatedRoute);
  private perms = inject(PermissionService);
  id = Number(this.route.snapshot.paramMap.get('id'));
  supplier = signal<Entity | null>(null);
  products = signal<Entity[]>([]);
  catalogProducts = signal<Entity[]>([]);
  confirmRemoveProductId = signal<number | null>(null);
  canManage = () => this.perms.has('proveedores.gestionar');
  availableProducts = computed(() => {
    const associated = new Set(this.products().map((product) => Number(product['id_producto'])));
    return this.catalogProducts().filter(
      (product) => product['activo'] && !associated.has(Number(product['id_producto'])),
    );
  });
  distributedBrands = computed(() => {
    const brands = this.products()
      .map((product) => this.productBrand(product['id_producto']))
      .filter((brand) => brand !== 'Marca sin identificar');
    return [...new Set(brands)].sort((a, b) => a.localeCompare(b, 'es'));
  });
  form = this.fb.group({
    id_producto: [null as number | null, Validators.required],
    codigo_proveedor: [''],
  });
  ngOnInit() {
    this.load();
  }
  load() {
    forkJoin({
      supplier: this.api.get(`suppliers/${this.id}`),
      products: this.api.list(`suppliers/${this.id}/products`),
      catalog: this.api.products({ page_size: 100 }),
    }).subscribe({
      next: (value) => {
        this.supplier.set(value.supplier);
        this.products.set(value.products);
        this.catalogProducts.set(value.catalog.items);
      },
      error: (e) => this.fail(e),
    });
  }
  add() {
    if (!this.canManage() || this.form.invalid) return;
    const v = this.form.getRawValue();
    this.api
      .post(`suppliers/${this.id}/products/${v.id_producto}`, {
        codigo_proveedor: v.codigo_proveedor || null,
      })
      .subscribe({
        next: () => {
          this.form.reset({ id_producto: null, codigo_proveedor: '' });
          this.load();
          this.ok('Producto asociado.');
        },
        error: (e) => this.fail(e),
      });
  }
  remove(id: number) {
    if (!this.canManage()) return;
    this.api.delete(`suppliers/${this.id}/products/${id}`).subscribe({
      next: () => {
        this.confirmRemoveProductId.set(null);
        this.load();
        this.ok('Asociación eliminada.');
      },
      error: (e) => this.fail(e),
    });
  }
  productBrand(productId: number): string {
    return String(
      this.catalogProducts().find(
        (product) => Number(product['id_producto']) === Number(productId),
      )?.['marca'] || 'Marca sin identificar',
    );
  }
}

@Component({
  selector: 'app-purchases-admin',
  imports: [CommonModule, ReactiveFormsModule],
  template: `<div class="admin-page">
    <header class="admin-page-heading">
      <div>
        <p class="eyebrow">Compras</p>
        <h1>Órdenes de compra</h1>
        <p>Solicitud, seguimiento y recepción de mercadería.</p>
      </div>
      @if (canManage()) {
        <button class="button button--primary" (click)="show.set(!show())">Nueva orden</button>
      }
    </header>
    @if (message()) {
      <div class="notice" [class.notice--error]="error()">{{ message() }}</div>
    }
    @if (show()) {
      <section class="admin-editor">
        <header><h2>Nueva orden</h2></header>
        <form [formGroup]="form" (ngSubmit)="save()" class="admin-form-grid">
          <label class="field"
            ><span>Proveedor</span
            ><select formControlName="id_proveedor" (change)="selectSupplier()">
              <option value="">Seleccionar proveedor</option>
              @for (supplier of suppliers(); track supplier['id_proveedor']) {
                <option [value]="supplier['id_proveedor']">{{ supplier['razon_social'] }}</option>
              }
            </select></label
          ><label class="field"
            ><span>Sucursal</span
            ><select formControlName="id_sucursal">
              <option value="">Seleccionar sucursal</option>
              @for (branch of branches(); track branch['id_sucursal']) {
                <option [value]="branch['id_sucursal']">{{ branch['nombre'] }}</option>
              }
            </select></label
          ><label class="field"
            ><span>Fecha estimada</span
            ><input type="date" formControlName="fecha_estimada" /></label
          ><label class="field field--wide"
            ><span>Observación</span><textarea formControlName="observacion"></textarea>
          </label>
          @if (!form.value.id_proveedor) {
            <p class="admin-complete-state field--wide">
              Selecciona un proveedor para mostrar únicamente los productos que distribuye.
            </p>
          } @else if (loadingSupplierProducts()) {
            <p class="admin-complete-state field--wide">Cargando productos del proveedor…</p>
          } @else if (supplierProducts().length === 0) {
            <p class="notice notice--error field--wide">
              Este proveedor no tiene productos asociados. Configúralos primero desde Proveedores.
            </p>
          }
          <div formArrayName="detalles" class="purchase-products field--wide">
            @for (row of details.controls; track row; let productIndex = $index) {
              <section [formGroupName]="productIndex" class="purchase-product">
                <header class="purchase-product__heading">
                  <strong>Producto {{ productIndex + 1 }}</strong>
                  <button
                    type="button"
                    class="button button--quiet button--danger-text"
                    [disabled]="details.length === 1"
                    (click)="removeRow(productIndex)"
                  >
                    Quitar producto
                  </button>
                </header>
                <div class="purchase-product__selectors">
                  <label class="field"
                    ><span>Marca</span
                    ><select formControlName="marca" (change)="changeProductBrand(productIndex)">
                      <option value="">Seleccionar marca</option>
                      @for (brand of brandsForProduct(productIndex); track brand) {
                        <option [value]="brand">{{ brand }}</option>
                      }
                    </select></label
                  ><label class="field"
                    ><span>Producto</span
                    ><select
                      formControlName="id_producto"
                      (change)="prepareProductMatrix(productIndex)"
                    >
                      <option value="">Seleccionar producto</option>
                      @for (product of productsForRow(productIndex); track product['id_producto']) {
                        <option [value]="product['id_producto']">{{ product['nombre'] }}</option>
                      }
                    </select></label
                  ><label class="field"
                    ><span>Costo unitario estimado</span
                    ><input
                      type="number"
                      min="0"
                      step=".01"
                      formControlName="costo_unitario_estimado"
                  /></label>
                </div>
                @if (productVariants(productIndex).length > 0) {
                  <div class="purchase-matrix-wrap">
                    <div class="purchase-matrix-intro">
                      <div>
                        <strong>Cantidades por color y talla</strong>
                        <small>Deja en 0 las combinaciones que no necesitas.</small>
                      </div>
                      <span
                        >{{ rowVariantCount(productIndex) }} variantes ·
                        {{ rowUnitCount(productIndex) }} unidades</span
                      >
                    </div>
                    <div formGroupName="cantidades" class="purchase-matrix-scroll">
                      <table class="purchase-matrix">
                        <thead>
                          <tr>
                            <th scope="col">Color</th>
                            @for (size of productSizes(productIndex); track size) {
                              <th scope="col">{{ size }}</th>
                            }
                          </tr>
                        </thead>
                        <tbody>
                          @for (color of productColors(productIndex); track color) {
                            <tr>
                              <th scope="row">{{ color }}</th>
                              @for (size of productSizes(productIndex); track size) {
                                <td>
                                  @if (variantForCell(productIndex, color, size); as variant) {
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      inputmode="numeric"
                                      [formControlName]="variant['id_variante']"
                                      [attr.aria-label]="'Cantidad de ' + color + ', talla ' + size"
                                    />
                                  } @else {
                                    <span
                                      class="purchase-matrix__missing"
                                      aria-label="No disponible"
                                      >—</span
                                    >
                                  }
                                </td>
                              }
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                } @else if (row.get('id_producto')?.value) {
                  <p class="admin-complete-state">Este producto no tiene variantes disponibles.</p>
                }
              </section>
            }
          </div>
          <div class="admin-form-actions">
            <button
              type="button"
              class="button button--secondary"
              [disabled]="!canAddProduct()"
              (click)="addRow()"
            >
              Añadir producto</button
            ><button class="button button--primary" [disabled]="!canSubmitOrder()">
              {{ savingOrder() ? 'Creando orden…' : 'Crear orden' }}
            </button>
          </div>
        </form>
      </section>
    }
    <div class="admin-card-list">
      @for (o of orders(); track o['id_orden_compra']) {
        <article>
          <header>
            <div>
              <span class="eyebrow">Orden #{{ o['id_orden_compra'] }}</span>
              <h2>{{ o['estado'] }}</h2>
            </div>
            <span>{{ o['fecha_orden'] | date: 'mediumDate' }}</span>
          </header>
          <p>
            {{ supplierName(o['id_proveedor']) }} · {{ branchName(o['id_sucursal']) }} ·
            {{ orderUnitCount(o) }} unidades en {{ o['detalles']?.length }} variantes
          </p>
          <details class="purchase-order-detail">
            <summary>Revisar cantidades solicitadas</summary>
            <div class="purchase-order-detail__scroll">
              <table>
                <thead>
                  <tr>
                    <th>Producto y variante</th>
                    <th>Pedido</th>
                    <th>Recibido</th>
                    <th>Pendiente</th>
                    <th>Costo estimado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (detail of o['detalles']; track detail['id_detalle_orden']) {
                    <tr>
                      <td>{{ variantName(detail['id_variante']) }}</td>
                      <td>{{ detail['cantidad'] }}</td>
                      <td>{{ detail['cantidad_recibida'] || 0 }}</td>
                      <td>
                        <strong>{{ detail['cantidad_pendiente'] ?? detail['cantidad'] }}</strong>
                      </td>
                      <td>
                        {{
                          detail['costo_unitario_estimado'] === null
                            ? 'Sin estimación'
                            : (detail['costo_unitario_estimado'] | number: '1.2-2')
                        }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </details>
          @if (canManage()) {
            <div class="admin-row-actions">
              @for (state of nextStates(o['estado']); track state) {
                <button (click)="setState(o, state)">{{ state }}</button>
              }
            </div>
          }
        </article>
      }
    </div>
  </div>`,
})
export class PurchasesAdmin extends BaseAdmin implements OnInit {
  private permissions = inject(PermissionService);
  canManage = () => this.permissions.has('proveedores.gestionar');
  orders = signal<Entity[]>([]);
  suppliers = signal<Entity[]>([]);
  branches = signal<Entity[]>([]);
  variants = signal<Entity[]>([]);
  catalogProducts = signal<Entity[]>([]);
  supplierProducts = signal<Entity[]>([]);
  loadingSupplierProducts = signal(false);
  savingOrder = signal(false);
  show = signal(false);
  form = this.fb.group({
    id_proveedor: [null as number | null, Validators.required],
    id_sucursal: [null as number | null, Validators.required],
    fecha_estimada: [''],
    observacion: [''],
    detalles: this.fb.array([]),
  });
  get details() {
    return this.form.controls.detalles as FormArray;
  }
  ngOnInit() {
    this.load();
    this.addRow();
  }
  load() {
    forkJoin({
      orders: this.api.list('purchase-orders'),
      suppliers: this.api.list('suppliers'),
      branches: this.api.list('branches'),
      variants: this.api.list('variants'),
      catalog: this.api.products({ page_size: 100 }),
    }).subscribe({
      next: (v) => {
        this.orders.set(v.orders);
        this.suppliers.set(v.suppliers);
        this.branches.set(v.branches);
        this.variants.set(v.variants);
        this.catalogProducts.set(v.catalog.items);
      },
      error: (e) => this.fail(e),
    });
  }
  supplierName(id: number) {
    return (
      this.suppliers().find((supplier) => supplier['id_proveedor'] === id)?.['razon_social'] ??
      `Proveedor ${id}`
    );
  }
  branchName(id: number) {
    return (
      this.branches().find((branch) => branch['id_sucursal'] === id)?.['nombre'] ?? `Sucursal ${id}`
    );
  }
  variantName(id: number): string {
    const variant = this.variants().find(
      (candidate) => Number(candidate['id_variante']) === Number(id),
    );
    return variant ? this.variantLabel(variant) : `Variante #${id}`;
  }
  variantLabel(variant: Entity): string {
    return `${variant['producto']} · ${variant['color']} · ${variant['talla']} (${variant['sku']})`;
  }
  orderUnitCount(order: Entity): number {
    return (order['detalles'] ?? []).reduce(
      (total: number, detail: Entity) => total + Number(detail['cantidad'] || 0),
      0,
    );
  }
  addRow() {
    this.details.push(
      this.fb.group({
        marca: ['', Validators.required],
        id_producto: [null as number | null, Validators.required],
        costo_unitario_estimado: [null, Validators.min(0)],
        cantidades: this.fb.group({}),
      }),
    );
  }
  removeRow(index: number) {
    if (this.details.length > 1) this.details.removeAt(index);
  }
  selectSupplier() {
    const supplierId = Number(this.form.value.id_proveedor);
    this.supplierProducts.set([]);
    this.details.controls.forEach((_, index) => this.resetProductRow(index));
    if (!supplierId) return;
    this.loadingSupplierProducts.set(true);
    this.api.list(`suppliers/${supplierId}/products`).subscribe({
      next: (products) => {
        if (Number(this.form.value.id_proveedor) !== supplierId) return;
        this.supplierProducts.set(products.filter((product) => product['activo']));
        this.loadingSupplierProducts.set(false);
      },
      error: (e) => {
        if (Number(this.form.value.id_proveedor) !== supplierId) return;
        this.loadingSupplierProducts.set(false);
        this.fail(e);
      },
    });
  }
  brandsForProduct(index: number): string[] {
    return this.uniqueSorted(
      this.productsForRow(index, false).map((product) => String(product['marca'])),
    );
  }
  productsForRow(index: number, filterBrand = true): Entity[] {
    const productIds = new Set(
      this.supplierProducts().map((product) => Number(product['id_producto'])),
    );
    const selectedElsewhere = new Set(
      this.details.controls
        .filter((_, detailIndex) => detailIndex !== index)
        .map((control) => Number(control.get('id_producto')?.value))
        .filter(Boolean),
    );
    const brand = filterBrand ? this.detailValue(index, 'marca') : '';
    return this.catalogProducts().filter(
      (product) =>
        productIds.has(Number(product['id_producto'])) &&
        !selectedElsewhere.has(Number(product['id_producto'])) &&
        (!filterBrand || !brand || product['marca'] === brand),
    );
  }
  changeProductBrand(index: number) {
    this.details.at(index).patchValue({ id_producto: null });
    this.clearQuantityControls(index);
  }
  prepareProductMatrix(index: number) {
    this.clearQuantityControls(index);
    const quantities = this.quantityGroup(index);
    this.productVariants(index).forEach((variant) => {
      quantities.addControl(
        String(variant['id_variante']),
        this.fb.control(0, [Validators.min(0), Validators.pattern(/^\d+$/)]),
      );
    });
  }
  productVariants(index: number): Entity[] {
    const productId = Number(this.details.at(index).get('id_producto')?.value);
    if (!productId) return [];
    return this.variants().filter((variant) => Number(variant['id_producto']) === productId);
  }
  productColors(index: number): string[] {
    return this.uniqueSorted(
      this.productVariants(index).map((variant) => String(variant['color'])),
    );
  }
  productSizes(index: number): string[] {
    return this.uniqueSizes(this.productVariants(index).map((variant) => String(variant['talla'])));
  }
  variantForCell(index: number, color: string, size: string): Entity | undefined {
    return this.productVariants(index).find(
      (variant) => variant['color'] === color && variant['talla'] === size,
    );
  }
  rowVariantCount(index: number): number {
    return this.productVariants(index).filter(
      (variant) => this.quantityValue(index, Number(variant['id_variante'])) > 0,
    ).length;
  }
  rowUnitCount(index: number): number {
    return this.productVariants(index).reduce(
      (total, variant) => total + this.quantityValue(index, Number(variant['id_variante'])),
      0,
    );
  }
  canAddProduct(): boolean {
    return Boolean(this.form.value.id_proveedor) && this.productsForRow(-1, false).length > 0;
  }
  canSubmitOrder(): boolean {
    return (
      this.canManage() &&
      !this.savingOrder() &&
      this.form.controls.id_proveedor.valid &&
      this.form.controls.id_sucursal.valid &&
      this.details.length > 0 &&
      this.details.controls.every((_, index) =>
        Boolean(this.details.at(index).get('id_producto')?.value && this.rowUnitCount(index) > 0),
      ) &&
      this.details.controls.every((control) => control.valid)
    );
  }
  private resetProductRow(index: number) {
    this.details.at(index).patchValue({ marca: '', id_producto: null });
    this.clearQuantityControls(index);
  }
  private clearQuantityControls(index: number) {
    const quantities = this.quantityGroup(index);
    Object.keys(quantities.controls).forEach((key) => quantities.removeControl(key));
  }
  private quantityGroup(index: number): FormGroup {
    return this.details.at(index).get('cantidades') as FormGroup;
  }
  private quantityValue(index: number, variantId: number): number {
    const value = Number(this.quantityGroup(index).get(String(variantId))?.value || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  private detailValue(index: number, field: string): string {
    return String(this.details.at(index).get(field)?.value || '');
  }
  private uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es'));
  }
  private uniqueSizes(values: string[]): string[] {
    const order = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    return [...new Set(values)].sort((a, b) => {
      const aIndex = order.indexOf(a.toUpperCase());
      const bIndex = order.indexOf(b.toUpperCase());
      if (aIndex === -1 || bIndex === -1) return a.localeCompare(b, 'es', { numeric: true });
      return aIndex - bIndex;
    });
  }
  save() {
    if (!this.canSubmitOrder()) return;
    const raw = this.form.getRawValue();
    const detalles = this.details.controls.flatMap((row, index) => {
      const cost = row.get('costo_unitario_estimado')?.value;
      return this.productVariants(index)
        .map((variant) => ({
          id_variante: variant['id_variante'],
          cantidad: this.quantityValue(index, Number(variant['id_variante'])),
          costo_unitario_estimado: cost === null || cost === '' ? null : Number(cost),
        }))
        .filter((detail) => detail.cantidad > 0);
    });
    const payload = {
      ...raw,
      fecha_estimada: raw.fecha_estimada || null,
      observacion: raw.observacion?.trim() || null,
      detalles,
    };
    this.savingOrder.set(true);
    this.api.post('purchase-orders', payload).subscribe({
      next: () => {
        this.savingOrder.set(false);
        this.show.set(false);
        this.load();
        this.ok('Orden creada.');
      },
      error: (e) => {
        this.savingOrder.set(false);
        this.fail(e);
      },
    });
  }
  nextStates(s: string) {
    return (
      (
        {
          SOLICITADA: ['CONFIRMADA', 'CANCELADA'],
          CONFIRMADA: ['EN_TRANSITO', 'CANCELADA'],
          EN_TRANSITO: ['CANCELADA'],
          PARCIAL: [],
          RECIBIDA: [],
          CANCELADA: [],
        } as any
      )[s] ?? []
    );
  }
  setState(o: Entity, estado: string) {
    this.api
      .patch(`purchase-orders/${o['id_orden_compra']}`, { estado })
      .subscribe({ next: () => this.load(), error: (e) => this.fail(e) });
  }
}

@Component({
  selector: 'app-receipts-admin',
  imports: [CommonModule, ReactiveFormsModule],
  template: `<div class="admin-page">
    <header class="admin-page-heading">
      <div>
        <p class="eyebrow">Compras</p>
        <h1>Recepciones</h1>
        <p>Registro transaccional de cantidades y costos recibidos.</p>
      </div>
      <button class="button button--primary" (click)="show.set(!show())">
        Registrar recepción
      </button>
    </header>
    @if (message()) {
      <div class="notice" [class.notice--error]="error()">{{ message() }}</div>
    }
    @if (show()) {
      <section class="admin-editor">
        <header>
          <div>
            <h2>Registrar recepción</h2>
            <p>Compara lo solicitado con lo que llegó realmente.</p>
          </div>
        </header>
        <form [formGroup]="form" (ngSubmit)="save()" class="admin-form-grid">
          <label class="field"
            ><span>Orden de compra</span
            ><select formControlName="id_orden_compra" (change)="selectOrder()">
              <option value="">Seleccionar orden</option>
              @for (order of availableOrders(); track order['id_orden_compra']) {
                <option [value]="order['id_orden_compra']">
                  Orden #{{ order['id_orden_compra'] }} - {{ order['estado'] }}
                </option>
              }
            </select></label
          ><label class="field field--wide"
            ><span>Observación</span><textarea formControlName="observacion"></textarea>
          </label>
          @if (selectedOrder(); as order) {
            <div class="receipt-order-context field--wide">
              <div>
                <span>Orden</span>
                <strong>#{{ order['id_orden_compra'] }}</strong>
              </div>
              <div>
                <span>Sucursal</span>
                <strong>{{ branchName(order['id_sucursal']) }}</strong>
              </div>
              <div>
                <span>Estado actual</span>
                <strong>{{ order['estado'] }}</strong>
              </div>
              <div>
                <span>Pendiente total</span>
                <strong>{{ pendingTotal() }} unidades</strong>
              </div>
            </div>
            <div formArrayName="detalles" class="receipt-lines field--wide">
              <div class="receipt-lines__heading">
                <div>
                  <h3>Control de cantidades</h3>
                  <p>Ingresa 0 en una variante que todavía no llegó.</p>
                </div>
                <button type="button" class="button button--secondary" (click)="markAllReceived()">
                  Marcar todo recibido
                </button>
              </div>
              <div class="receipt-lines__scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Producto y variante</th>
                      <th>Pedido</th>
                      <th>Recibido antes</th>
                      <th>Pendiente</th>
                      <th>Recibido ahora</th>
                      <th>Costo unitario</th>
                      <th>Número de lote</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of details.controls; track row; let index = $index) {
                      <tr [formGroupName]="index">
                        <td>
                          <strong>{{ variantName(row.value.id_variante) }}</strong>
                        </td>
                        <td>{{ row.value.cantidad_solicitada }}</td>
                        <td>{{ row.value.cantidad_recibida_anterior }}</td>
                        <td>{{ row.value.cantidad_pendiente }}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            inputmode="numeric"
                            formControlName="cantidad_recibida"
                            [max]="row.value.cantidad_pendiente"
                            [attr.aria-label]="
                              'Cantidad recibida de ' + variantName(row.value.id_variante)
                            "
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step=".01"
                            formControlName="costo_unitario"
                            [attr.aria-label]="
                              'Costo unitario de ' + variantName(row.value.id_variante)
                            "
                          />
                        </td>
                        <td>
                          <input
                            formControlName="numero_lote"
                            [attr.aria-label]="
                              'Número de lote de ' + variantName(row.value.id_variante)
                            "
                          />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="receipt-result">
                <span>Se registran {{ receivedNowTotal() }} unidades</span>
                <strong>
                  {{
                    completesOrder()
                      ? 'La orden quedará recibida'
                      : 'Se registrará una recepción parcial'
                  }}
                </strong>
              </div>
            </div>
          } @else {
            <p class="admin-complete-state field--wide">
              Selecciona una orden para revisar las cantidades solicitadas.
            </p>
          }
          <div class="admin-form-actions">
            <button class="button button--primary" [disabled]="!canSubmitReceipt()">
              {{ savingReceipt() ? 'Registrando…' : 'Confirmar recepción' }}
            </button>
          </div>
        </form>
      </section>
    }
    <div class="admin-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Recepción</th>
            <th>Orden</th>
            <th>Sucursal</th>
            <th>Fecha</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          @for (r of items(); track r['id_recepcion']) {
            <tr>
              <td>#{{ r['id_recepcion'] }}</td>
              <td>#{{ r['id_orden_compra'] }}</td>
              <td>{{ branchName(r['id_sucursal']) }}</td>
              <td>{{ r['fecha_recepcion'] | date: 'short' }}</td>
              <td>{{ r['estado'] }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  </div>`,
})
export class ReceiptsAdmin extends BaseAdmin implements OnInit {
  items = signal<Entity[]>([]);
  orders = signal<Entity[]>([]);
  variants = signal<Entity[]>([]);
  branches = signal<Entity[]>([]);
  savingReceipt = signal(false);
  availableOrders = () =>
    this.orders().filter((order) => !['RECIBIDA', 'CANCELADA'].includes(order['estado']));
  show = signal(false);
  form = this.fb.group({
    id_orden_compra: [null as number | null, Validators.required],
    observacion: [''],
    detalles: this.fb.array([]),
  });
  get details() {
    return this.form.controls.detalles as FormArray;
  }
  selectedOrder(): Entity | null {
    return (
      this.orders().find(
        (order) => Number(order['id_orden_compra']) === Number(this.form.value.id_orden_compra),
      ) ?? null
    );
  }
  ngOnInit() {
    this.load();
  }
  load() {
    forkJoin({
      receipts: this.api.list('receipts'),
      orders: this.api.list('purchase-orders'),
      variants: this.api.list('variants'),
      branches: this.api.list('branches'),
    }).subscribe({
      next: (v) => {
        this.items.set(v.receipts);
        this.orders.set(v.orders);
        this.variants.set(v.variants);
        this.branches.set(v.branches);
      },
      error: (e) => this.fail(e),
    });
  }
  addRow(detail?: Entity) {
    const pending = Number(detail?.['cantidad_pendiente'] ?? detail?.['cantidad'] ?? 0);
    if (pending <= 0) return;
    this.details.push(
      this.fb.group({
        id_variante: [detail?.['id_variante'] ?? null, Validators.required],
        cantidad_solicitada: [Number(detail?.['cantidad'] ?? 0)],
        cantidad_recibida_anterior: [Number(detail?.['cantidad_recibida'] ?? 0)],
        cantidad_pendiente: [pending],
        cantidad_recibida: [
          pending,
          [
            Validators.required,
            Validators.min(0),
            Validators.max(pending),
            Validators.pattern(/^\d+$/),
          ],
        ],
        costo_unitario: [
          detail?.['costo_unitario_estimado'] ?? 0,
          [Validators.required, Validators.min(0)],
        ],
        numero_lote: [''],
      }),
    );
  }
  selectOrder() {
    this.details.clear();
    const selected = this.orders().find(
      (order) => Number(order['id_orden_compra']) === Number(this.form.value.id_orden_compra),
    );
    for (const detail of selected?.['detalles'] ?? []) this.addRow(detail);
  }
  variantLabel(variant: Entity) {
    return `${variant['producto']} · ${variant['color']} · ${variant['talla']} (${variant['sku']})`;
  }
  variantName(id: number): string {
    const variant = this.variants().find(
      (candidate) => Number(candidate['id_variante']) === Number(id),
    );
    return variant ? this.variantLabel(variant) : `Variante #${id}`;
  }
  pendingTotal(): number {
    return this.details.controls.reduce(
      (total, row) => total + Number(row.value.cantidad_pendiente || 0),
      0,
    );
  }
  receivedNowTotal(): number {
    return this.details.controls.reduce(
      (total, row) => total + Number(row.value.cantidad_recibida || 0),
      0,
    );
  }
  completesOrder(): boolean {
    return this.pendingTotal() > 0 && this.receivedNowTotal() === this.pendingTotal();
  }
  markAllReceived(): void {
    this.details.controls.forEach((row) =>
      row.patchValue({ cantidad_recibida: Number(row.value.cantidad_pendiente || 0) }),
    );
  }
  canSubmitReceipt(): boolean {
    return (
      !this.savingReceipt() &&
      this.form.controls.id_orden_compra.valid &&
      this.details.length > 0 &&
      this.details.valid &&
      this.receivedNowTotal() > 0
    );
  }
  branchName(id: number) {
    return (
      this.branches().find((branch) => branch['id_sucursal'] === id)?.['nombre'] ?? `Sucursal ${id}`
    );
  }
  save() {
    if (!this.canSubmitReceipt()) return;
    const raw = this.form.getRawValue();
    const receiptDetails = raw.detalles as Array<{
      id_variante: number | null;
      cantidad_recibida: number | null;
      costo_unitario: number | null;
      numero_lote: string | null;
    }>;
    const payload = {
      id_orden_compra: raw.id_orden_compra,
      observacion: raw.observacion?.trim() || null,
      detalles: receiptDetails
        .filter((detail) => Number(detail.cantidad_recibida) > 0)
        .map((detail) => ({
          id_variante: detail.id_variante,
          cantidad_recibida: Number(detail.cantidad_recibida),
          costo_unitario: Number(detail.costo_unitario),
          numero_lote: detail.numero_lote?.trim() || null,
        })),
    };
    this.savingReceipt.set(true);
    this.api.post('receipts', payload).subscribe({
      next: () => {
        this.savingReceipt.set(false);
        this.show.set(false);
        this.form.reset({ id_orden_compra: null, observacion: '' });
        this.details.clear();
        this.load();
        this.ok('Recepción registrada.');
      },
      error: (e) => {
        this.savingReceipt.set(false);
        this.fail(e);
      },
    });
  }
}

@Component({
  selector: 'app-inventory-admin',
  imports: [CommonModule, ReactiveFormsModule],
  template: `<div class="admin-page">
    <header class="admin-page-heading">
      <div>
        <p class="eyebrow">Inventario</p>
        <h1>Existencias</h1>
        <p>Stock físico, reservado y disponible por variante y sucursal.</p>
      </div>
    </header>
    <form [formGroup]="filters" (ngSubmit)="load()" class="admin-filterbar">
      <label class="field"
        ><span>Sucursal</span
        ><select formControlName="sucursal">
          <option value="">Todas las sucursales</option>
          @for (branch of branches(); track branch['id_sucursal']) {
            <option [value]="branch['id_sucursal']">{{ branch['nombre'] }}</option>
          }
        </select></label
      ><label class="check-field"
        ><input type="checkbox" formControlName="stock_bajo" /> Solo stock bajo</label
      ><label class="check-field"
        ><input type="checkbox" formControlName="agotado" /> Solo agotado</label
      ><button class="button button--secondary">Aplicar</button>
    </form>
    @if (message()) {
      <div class="notice" [class.notice--error]="error()">{{ message() }}</div>
    }
    <div class="admin-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Sucursal</th>
            <th>Físico</th>
            <th>Reservado</th>
            <th>Disponible</th>
            <th>Mínimo</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          @for (i of items(); track i['id_inventario']) {
            <tr>
              <td>
                <strong>{{ i['producto'] }}</strong
                ><small>{{ i['sku'] }} · {{ i['talla'] }} · {{ i['color'] }}</small>
              </td>
              <td>{{ i['sucursal'] }}</td>
              <td>{{ i['stock_fisico'] }}</td>
              <td>{{ i['stock_reservado'] }}</td>
              <td>{{ i['stock_disponible'] }}</td>
              <td>{{ i['stock_minimo'] }}</td>
              <td>
                <span class="status-chip">{{ i['estado_stock'] }}</span>
              </td>
              <td class="admin-row-actions">
                @if (canMove()) {
                  <button (click)="select(i)">Gestionar</button>
                } @else {
                  <span>Solo lectura</span>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    @if (selected(); as i) {
      <section class="admin-editor">
        <header>
          <h2>{{ i['producto'] }} · {{ i['sku'] }}</h2>
          <button class="button button--quiet" (click)="selected.set(null)">Cerrar</button>
        </header>
        <div class="admin-detail-grid">
          <form [formGroup]="minimum" (ngSubmit)="saveMinimum(i)" class="admin-inline-form">
            <label class="field"
              ><span>Stock mínimo</span
              ><input type="number" min="0" formControlName="stock_minimo" /></label
            ><button class="button button--secondary">Actualizar</button>
          </form>
          <form
            [formGroup]="adjustment"
            (ngSubmit)="adjust(i)"
            class="admin-form-grid admin-form-grid--two"
          >
            <label class="field"
              ><span>Tipo</span
              ><select formControlName="tipo">
                <option>AJUSTE_POSITIVO</option>
                <option>AJUSTE_NEGATIVO</option>
              </select></label
            ><label class="field"
              ><span>Cantidad</span
              ><input type="number" min="1" formControlName="cantidad" /></label
            ><label class="field field--wide"
              ><span>Motivo obligatorio</span><input formControlName="motivo" /></label
            ><button class="button button--primary" [disabled]="adjustment.invalid">
              Registrar ajuste
            </button>
          </form>
        </div>
        <p class="admin-help">
          El stock físico no se edita directamente; el ajuste genera un movimiento inmutable.
        </p>
      </section>
    }
  </div>`,
})
export class InventoryAdmin extends BaseAdmin implements OnInit {
  private permissions = inject(PermissionService);
  canMove = () => this.permissions.has('inventario.movimiento');
  items = signal<Entity[]>([]);
  branches = signal<Entity[]>([]);
  selected = signal<Entity | null>(null);
  filters = this.fb.group({
    sucursal: [null as number | null],
    stock_bajo: [false],
    agotado: [false],
  });
  minimum = this.fb.group({ stock_minimo: [0, [Validators.required, Validators.min(0)]] });
  adjustment = this.fb.group({
    tipo: ['AJUSTE_POSITIVO', Validators.required],
    cantidad: [1, [Validators.required, Validators.min(1)]],
    motivo: ['', Validators.required],
  });
  ngOnInit() {
    this.loadBranches();
    this.load();
  }
  load() {
    this.api.list('inventory', this.filters.getRawValue()).subscribe({
      next: (inventory) => this.items.set(inventory),
      error: (e) => this.fail(e),
    });
  }
  private loadBranches() {
    this.api.list('branches').subscribe({
      next: (branches) => this.branches.set(branches),
      error: (e) => this.fail(e),
    });
  }
  select(i: Entity) {
    this.api.get(`inventory/${i['id_inventario']}`).subscribe({
      next: (detail) => {
        this.selected.set(detail);
        this.minimum.patchValue({ stock_minimo: detail['stock_minimo'] });
      },
      error: (e) => this.fail(e),
    });
  }
  saveMinimum(i: Entity) {
    this.api
      .patch(`inventory/${i['id_inventario']}/minimum-stock`, this.minimum.getRawValue())
      .subscribe({
        next: () => {
          this.load();
          this.ok('Stock mínimo actualizado.');
        },
        error: (e) => this.fail(e),
      });
  }
  adjust(i: Entity) {
    this.api
      .post(`inventory/${i['id_inventario']}/adjustments`, this.adjustment.getRawValue())
      .subscribe({
        next: () => {
          this.load();
          this.ok('Ajuste registrado.');
          this.selected.set(null);
        },
        error: (e) => this.fail(e),
      });
  }
}

@Component({
  selector: 'app-trace-admin',
  imports: [CommonModule, ReactiveFormsModule],
  template: `<div class="admin-page">
    <header class="admin-page-heading">
      <div>
        <p class="eyebrow">Inventario · Trazabilidad</p>
        <h1>{{ title() }}</h1>
        <p>{{ description() }}</p>
      </div>
      @if (mode() === 'transfers' && canMove()) {
        <button class="button button--primary" (click)="show.set(!show())">
          Nueva transferencia
        </button>
      }
    </header>
    @if (message()) {
      <div class="notice" [class.notice--error]="error()">{{ message() }}</div>
    }
    @if (show()) {
      <section class="admin-editor">
        <form [formGroup]="transfer" (ngSubmit)="createTransfer()" class="admin-form-grid">
          <label class="field"
            ><span>Sucursal origen</span
            ><select formControlName="id_sucursal_origen">
              <option value="">Seleccionar sucursal</option>
              @for (branch of branches(); track branch['id_sucursal']) {
                <option [value]="branch['id_sucursal']">{{ branch['nombre'] }}</option>
              }
            </select></label
          ><label class="field"
            ><span>Sucursal destino</span
            ><select formControlName="id_sucursal_destino">
              <option value="">Seleccionar sucursal</option>
              @for (branch of branches(); track branch['id_sucursal']) {
                <option [value]="branch['id_sucursal']">{{ branch['nombre'] }}</option>
              }
            </select></label
          >
          <div formArrayName="detalles" class="admin-repeater field--wide">
            @for (row of transferDetails.controls; track $index) {
              <div [formGroupName]="$index">
                <label class="field"
                  ><span>Producto y variante</span
                  ><select formControlName="id_variante">
                    <option value="">Seleccionar variante</option>
                    @for (variant of variants(); track variant['id_variante']) {
                      <option [value]="variant['id_variante']">{{ variantLabel(variant) }}</option>
                    }
                  </select></label
                ><label class="field"
                  ><span>Cantidad</span
                  ><input type="number" min="1" formControlName="cantidad" /></label
                ><button
                  type="button"
                  class="button button--quiet"
                  [disabled]="transferDetails.length === 1"
                  (click)="transferDetails.removeAt($index)"
                >
                  Quitar
                </button>
              </div>
            }
          </div>
          <div class="admin-form-actions">
            <button type="button" class="button button--secondary" (click)="addTransferRow()">
              Añadir línea
            </button>
            <button class="button button--primary" [disabled]="transfer.invalid">
              Crear transferencia
            </button>
          </div>
        </form>
      </section>
    }
    <div class="admin-card-list">
      @for (x of items(); track identity(x)) {
        <article>
          <header>
            <div>
              <span class="eyebrow">#{{ identity(x) }}</span>
              <h2>{{ primary(x) }}</h2>
            </div>
            <span>{{ dateOf(x) | date: 'short' }}</span>
          </header>
          <p>{{ summary(x) }}</p>
          @if (mode() === 'movements' && x['lotes']?.length) {
            <div class="admin-lot-trace">
              @for (l of x['lotes']; track l['id_lote']) {
                <span
                  >Lote {{ l['id_lote'] }} · {{ l['cantidad'] }} u. · Bs
                  {{ l['costo_unitario'] }}</span
                >
              }
            </div>
          }
          @if (mode() === 'transfers' && canMove()) {
            <div class="admin-row-actions">
              @for (s of transferStates(x['estado']); track s) {
                <button (click)="changeTransfer(x, s)">{{ s }}</button>
              }
            </div>
          }
        </article>
      } @empty {
        <p>No hay registros.</p>
      }
    </div>
  </div>`,
})
export class TraceAdmin extends BaseAdmin implements OnInit {
  private route = inject(ActivatedRoute);
  private permissions = inject(PermissionService);
  canMove = () => this.permissions.has('inventario.movimiento');
  mode = signal('lots');
  items = signal<Entity[]>([]);
  branches = signal<Entity[]>([]);
  variants = signal<Entity[]>([]);
  show = signal(false);
  transfer = this.fb.group({
    id_sucursal_origen: [null as number | null, Validators.required],
    id_sucursal_destino: [null as number | null, Validators.required],
    detalles: this.fb.array([]),
  });
  get transferDetails() {
    return this.transfer.controls.detalles as FormArray;
  }
  ngOnInit() {
    this.route.data.subscribe((d) => {
      this.mode.set(d['mode']);
      this.load();
      if (d['mode'] === 'transfers' && this.transferDetails.length === 0) {
        this.addTransferRow();
      }
    });
  }
  title() {
    return this.mode() === 'lots'
      ? 'Lotes'
      : this.mode() === 'movements'
        ? 'Movimientos'
        : 'Transferencias';
  }
  description() {
    return this.mode() === 'lots'
      ? 'Origen histórico, costos y disponibilidad por lote.'
      : this.mode() === 'movements'
        ? 'Registro inmutable de entradas y salidas.'
        : 'Flujo entre sucursales sin exponer controles internos FIFO.';
  }
  path() {
    return this.mode() === 'lots'
      ? 'inventory/lots'
      : this.mode() === 'movements'
        ? 'inventory/movements'
        : 'inventory/transfers';
  }
  load() {
    if (this.mode() !== 'transfers') {
      this.api
        .list(this.path())
        .subscribe({ next: (v) => this.items.set(v), error: (e) => this.fail(e) });
      return;
    }
    forkJoin({
      items: this.api.list(this.path()),
      branches: this.api.list('branches'),
      variants: this.api.list('variants'),
    }).subscribe({
      next: (v) => {
        this.items.set(v.items);
        this.branches.set(v.branches);
        this.variants.set(v.variants);
      },
      error: (e) => this.fail(e),
    });
  }
  identity(x: Entity) {
    return x['id_lote'] ?? x['id_movimiento'] ?? x['id_transferencia'];
  }
  primary(x: Entity) {
    return x['tipo_movimiento'] ?? x['estado'] ?? `Lote ${x['numero_lote'] || x['id_lote']}`;
  }
  dateOf(x: Entity) {
    return x['fecha_hora'] ?? x['fecha_solicitud'] ?? x['fecha_ingreso'];
  }
  summary(x: Entity) {
    if (this.mode() === 'lots')
      return `Sucursal ${x['id_sucursal']} · Variante ${x['id_variante']} · ${x['cantidad_disponible']} de ${x['cantidad_inicial']} · Bs ${x['costo_unitario']}`;
    if (this.mode() === 'movements')
      return `Inventario ${x['id_inventario']} · ${x['cantidad']} unidades · ${x['referencia_tipo'] || 'Sin referencia'}`;
    return `${this.branchName(x['id_sucursal_origen'])} a ${this.branchName(x['id_sucursal_destino'])} · ${x['detalles']?.length} línea(s)`;
  }
  addTransferRow() {
    this.transferDetails.push(
      this.fb.group({
        id_variante: [null as number | null, Validators.required],
        cantidad: [1, [Validators.required, Validators.min(1)]],
      }),
    );
  }
  variantLabel(variant: Entity) {
    return `${variant['producto']} - ${variant['talla']} / ${variant['color']} (${variant['sku']})`;
  }
  branchName(id: number) {
    return (
      this.branches().find((branch) => branch['id_sucursal'] === id)?.['nombre'] ?? `Sucursal ${id}`
    );
  }
  createTransfer() {
    const v = this.transfer.getRawValue();
    if (v.id_sucursal_origen === v.id_sucursal_destino) {
      this.error.set(true);
      this.message.set('Selecciona sucursales de origen y destino diferentes.');
      return;
    }
    const payload = {
      id_sucursal_origen: v.id_sucursal_origen,
      id_sucursal_destino: v.id_sucursal_destino,
      detalles: v.detalles,
    };
    this.api.post('inventory/transfers', payload).subscribe({
      next: () => {
        this.show.set(false);
        this.load();
        this.ok('Transferencia creada.');
      },
      error: (e) => this.fail(e),
    });
  }
  transferStates(s: string) {
    return (
      (
        {
          SOLICITADA: ['APROBADA', 'CANCELADA'],
          APROBADA: ['EN_TRANSITO', 'CANCELADA'],
          EN_TRANSITO: ['RECIBIDA', 'CANCELADA'],
          RECIBIDA: [],
          CANCELADA: [],
        } as any
      )[s] ?? []
    );
  }
  changeTransfer(x: Entity, estado: string) {
    this.api
      .patch(`inventory/transfers/${x['id_transferencia']}/status`, { estado })
      .subscribe({ next: () => this.load(), error: (e) => this.fail(e) });
  }
}
