import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
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
  imports: [ReactiveFormsModule, FormsModule, BolivianosPipe],
  template: `
    <section class="pos-sales-page">
      <header class="admin-page-heading">
        <div>
          <p class="eyebrow">Punto de Venta</p>
          <h1>Venta Presencial (POS)</h1>
          <p>Registra ventas en mostrador con deducción automática de inventario físico y costeo FIFO.</p>
        </div>
      </header>

      @if (error()) {
        <div class="admin-notice admin-notice--error" role="alert">
          <span>{{ error() }}</span>
          <button type="button" class="pos-notice-close" (click)="error.set('')" aria-label="Cerrar">✕</button>
        </div>
      }

      @if (completed(); as sale) {
        <div class="admin-panel pos-success-panel">
          <div class="pos-success-badge">✓ Cobro Exitoso</div>
          <h2>Venta #{{ sale.id_venta }} Completada</h2>
          <p class="pos-success-lead">
            Total cobrado en efectivo: <strong>{{ sale.total | bolivianos }}</strong> en <strong>{{ sale.sucursal }}</strong>.
          </p>
          <div class="pos-success-details">
            <div class="pos-success-metric">
              <span>Canal de venta</span>
              <strong>Presencial / Mostrador</strong>
            </div>
            <div class="pos-success-metric">
              <span>Modalidad de entrega</span>
              <strong>Directa</strong>
            </div>
            <div class="pos-success-metric">
              <span>Prendas vendidas</span>
              <strong>{{ sale.items.length }} ítem(s)</strong>
            </div>
            <div class="pos-success-metric">
              <span>Fecha y hora</span>
              <strong>{{ sale.fecha_venta }}</strong>
            </div>
          </div>
          <div class="pos-success-actions">
            <button type="button" class="button button--secondary" (click)="printTicket()">
              🖨️ Imprimir comprobante
            </button>
            <button type="button" class="button button--primary" (click)="resetPos()">
              + Iniciar nueva venta
            </button>
          </div>
        </div>
      }

      <!-- Control de Sucursal: Basado en rol (Cajero fijo vs Admin selector) -->
      <div class="pos-branch-card admin-panel">
        @if (!canSelectBranch()) {
          <div class="pos-branch-assigned-banner">
            <div class="pos-branch-assigned-icon">📍</div>
            <div class="pos-branch-assigned-text">
              <span class="pos-branch-assigned-label">Sucursal asignada a tu usuario</span>
              <strong class="pos-branch-assigned-name">{{ assignedBranchName() }}</strong>
            </div>
            <span class="pos-status-badge pos-status-badge--locked">
              <span class="pos-dot-pulse"></span>
              Caja Asignada (Fija)
            </span>
          </div>
        } @else {
          <div class="pos-branch-admin-banner">
            <label class="field pos-branch-select-field">
              <span>📍 Sucursal de atención (Administración general)</span>
              <select [value]="selectedBranchId() ?? ''" (change)="onBranchChange($any($event.target).value)">
                <option value="">-- Selecciona sucursal para la venta --</option>
                @for (branch of branches(); track branch.id_sucursal) {
                  <option [value]="branch.id_sucursal">{{ branch.nombre }}</option>
                }
              </select>
            </label>
            @if (selectedBranchId()) {
              <span class="pos-status-badge pos-status-badge--active">
                <span class="pos-dot-pulse"></span>
                Sucursal activa
              </span>
            }
          </div>
        }
      </div>

      <!-- Lector rápido de código de barras o SKU -->
      <div class="admin-panel pos-scanner-panel">
        <div class="pos-scanner-header">
          <span class="pos-scanner-title">⚡ Lector rápido de Códigos de Barras / SKU</span>
          <span class="pos-scanner-hint">Pistola lectora o ingreso manual</span>
        </div>
        <div class="pos-scanner-row">
          <div class="pos-scanner-input-wrap">
            <span class="pos-scanner-icon">🏷️</span>
            <input
              type="text"
              placeholder="Escanear código de barras o ingresar SKU (ej. POL-OVR-NEG-M) y presionar Enter…"
              [value]="barcodeQuery()"
              (input)="barcodeQuery.set($any($event.target).value)"
              (keydown.enter)="$event.preventDefault(); onBarcodeScan(barcodeQuery())"
            />
          </div>
          <button
            type="button"
            class="button button--secondary pos-scan-btn"
            [disabled]="!barcodeQuery().trim()"
            (click)="onBarcodeScan(barcodeQuery())"
          >
            Buscar prenda
          </button>
        </div>
        @if (barcodeMatchNotice()) {
          <div class="pos-scanner-match">
            <span>{{ barcodeMatchNotice() }}</span>
          </div>
        }
      </div>

      <!-- Selector Cascada de Prendas: Marca -> Modelo -> Talla -> Color -> Cantidad -->
      <div class="admin-panel pos-cascade-panel">
        <div class="pos-cascade-header">
          <div>
            <h2>Selección guiada de prenda</h2>
            <p>Selecciona ordenadamente para consultar existencias físicas de la sucursal.</p>
          </div>
          @if (selectedBrandId() || selectedProductId()) {
            <button type="button" class="text-button" (click)="clearSelection()">
              Limpiar selección
            </button>
          }
        </div>

        <div class="pos-cascade-grid">
          <!-- 1. Marca -->
          <label class="field pos-cascade-field">
            <span class="pos-step-num">1. Marca</span>
            <select [value]="selectedBrandId() ?? ''" (change)="onBrandChange($any($event.target).value)">
              <option value="">-- Seleccionar Marca --</option>
              @for (b of brands(); track b.id) {
                <option [value]="b.id">{{ b.nombre }}</option>
              }
            </select>
          </label>

          <!-- 2. Modelo / Prenda -->
          <label class="field pos-cascade-field">
            <span class="pos-step-num">2. Modelo / Prenda</span>
            <select
              [disabled]="!selectedBrandId()"
              [value]="selectedProductId() ?? ''"
              (change)="onProductChange($any($event.target).value)"
            >
              <option value="">{{ selectedBrandId() ? '-- Seleccionar Prenda --' : 'Primero elige marca' }}</option>
              @for (p of productsForBrand(); track p.id_producto) {
                <option [value]="p.id_producto">{{ p.nombre }} ({{ p.precio_actual | bolivianos }})</option>
              }
            </select>
          </label>

          <!-- 3. Talla -->
          <label class="field pos-cascade-field">
            <span class="pos-step-num">3. Talla</span>
            <select
              [disabled]="!selectedProductId()"
              [value]="selectedSize()"
              (change)="onSizeChange($any($event.target).value)"
            >
              <option value="">{{ selectedProductId() ? '-- Talla --' : 'Elige prenda' }}</option>
              @for (t of availableSizes(); track t) {
                <option [value]="t">Talla {{ t }}</option>
              }
            </select>
          </label>

          <!-- 4. Color y Stock -->
          <label class="field pos-cascade-field">
            <span class="pos-step-num">4. Color y Existencias</span>
            <select
              [disabled]="!selectedSize()"
              [value]="selectedVariantId() ?? ''"
              (change)="onVariantChange($any($event.target).value)"
            >
              <option value="">{{ selectedSize() ? '-- Color --' : 'Elige talla' }}</option>
              @for (v of availableVariantsForSize(); track v.id_variante) {
                <option [value]="v.id_variante" [disabled]="(v.stock_disponible ?? 0) <= 0">
                  {{ v.color }} — {{ (v.stock_disponible ?? 0) > 0 ? (v.stock_disponible + ' disponibles') : 'AGOTADO' }}
                </option>
              }
            </select>
          </label>
        </div>

        <!-- Previsualización de Prenda Seleccionada y Cantidad -->
        @if (selectedVariant(); as v) {
          <div class="pos-selection-preview">
            <div class="pos-preview-media">
              @if (selectedProduct()?.imagen_principal?.secure_url) {
                <img [src]="selectedProduct()?.imagen_principal?.secure_url" [alt]="selectedProduct()?.nombre" class="pos-preview-img" />
              } @else {
                <div class="pos-preview-placeholder">👗</div>
              }
              <div class="pos-preview-meta">
                <strong>{{ selectedProduct()?.nombre }}</strong>
                <span class="pos-preview-sub">
                  Marca: <em>{{ selectedProduct()?.marca }}</em> · Talla: <strong>{{ v.talla }}</strong> · Color: <strong>{{ v.color }}</strong>
                </span>
                <div class="pos-preview-badges">
                  <span class="pos-sku-badge">{{ v.sku }}</span>
                  @if ((v.stock_disponible ?? 0) > 0) {
                    <span class="pos-stock-badge pos-stock-badge--ok">
                      ✓ {{ v.stock_disponible }} unidad(es) disponible(s) en sucursal
                    </span>
                  } @else {
                    <span class="pos-stock-badge pos-stock-badge--empty">
                      ✕ Sin existencias en esta sucursal
                    </span>
                  }
                </div>
              </div>
            </div>

            <div class="pos-preview-action">
              <div class="pos-stepper-box">
                <span class="pos-stepper-label">5. Cantidad</span>
                <div class="pos-stepper">
                  <button type="button" class="pos-stepper-btn" (click)="decrementQty()" [disabled]="quantity() <= 1">−</button>
                  <input
                    type="number"
                    min="1"
                    [max]="selectedStock() || 1"
                    [value]="quantity()"
                    (input)="onQuantityInput($any($event.target).value)"
                  />
                  <button
                    type="button"
                    class="pos-stepper-btn"
                    (click)="incrementQty()"
                    [disabled]="quantity() >= selectedStock()"
                  >+</button>
                </div>
              </div>

              <div class="pos-subtotal-box">
                <span class="pos-subtotal-label">Subtotal prenda</span>
                <strong class="pos-subtotal-val">{{ currentItemSubtotal() | bolivianos }}</strong>
              </div>

              <button
                type="button"
                class="button button--primary pos-add-btn"
                [disabled]="!canAddCurrentVariant()"
                (click)="addLine()"
              >
                + Agregar a venta
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Ticket de Venta / Carrito POS -->
      @if (lines().length) {
        <div class="admin-panel pos-ticket-panel">
          <div class="pos-ticket-header">
            <div class="pos-ticket-title-wrap">
              <h2>🧾 Comprobante / Ticket de Venta</h2>
              <span class="pos-ticket-badge">{{ lines().length }} ítem(s) agregado(s)</span>
            </div>
            <button type="button" class="text-button text-button--danger" (click)="clearTicket()">
              Vaciar ticket
            </button>
          </div>

          <div class="pos-ticket-table-wrap">
            <table class="pos-ticket-table">
              <thead>
                <tr>
                  <th>Prenda</th>
                  <th>Talla & Color</th>
                  <th>SKU</th>
                  <th>Precio Unitario</th>
                  <th>Cantidad</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (line of lines(); track line.variant.id_variante) {
                  <tr>
                    <td class="pos-col-product">
                      <div class="pos-table-product">
                        @if (line.product.imagen_principal?.secure_url) {
                          <img [src]="line.product.imagen_principal?.secure_url" [alt]="line.product.nombre" class="pos-table-thumb" />
                        } @else {
                          <div class="pos-table-thumb-empty">👗</div>
                        }
                        <div>
                          <strong>{{ line.product.nombre }}</strong>
                          <small class="pos-table-brand">{{ line.product.marca }}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="pos-variant-tags">
                        <span class="pos-pill pos-pill--size">Talla {{ line.variant.talla }}</span>
                        <span class="pos-pill pos-pill--color">
                          @if (line.variant.codigo_hex) {
                            <span class="pos-color-dot" [style.background-color]="line.variant.codigo_hex"></span>
                          }
                          {{ line.variant.color }}
                        </span>
                      </div>
                    </td>
                    <td>
                      <code class="pos-table-sku">{{ line.variant.sku }}</code>
                    </td>
                    <td class="pos-col-price">
                      {{ line.product.precio_actual | bolivianos }}
                    </td>
                    <td class="pos-col-qty">
                      <div class="pos-table-stepper">
                        <button type="button" (click)="updateLineQty(line.variant.id_variante, -1)">−</button>
                        <span>{{ line.quantity }}</span>
                        <button
                          type="button"
                          (click)="updateLineQty(line.variant.id_variante, 1)"
                          [disabled]="line.quantity >= (line.variant.stock_disponible ?? 999)"
                        >+</button>
                      </div>
                    </td>
                    <td class="pos-col-subtotal">
                      <strong>{{ lineSubtotal(line) | bolivianos }}</strong>
                    </td>
                    <td class="pos-col-remove">
                      <button
                        class="pos-remove-btn"
                        type="button"
                        title="Quitar prenda del ticket"
                        (click)="removeLine(line.variant.id_variante)"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <footer class="pos-ticket-footer">
            <div class="pos-ticket-total-wrap">
              <span class="pos-ticket-total-label">Total a cobrar en efectivo:</span>
              <strong class="pos-ticket-total-value">{{ estimatedTotal() | bolivianos }}</strong>
            </div>
            <div class="pos-ticket-action-wrap">
              <button
                class="button button--primary button--lg pos-checkout-btn"
                type="button"
                [disabled]="saving() || !selectedBranchId()"
                (click)="confirm()"
              >
                @if (saving()) {
                  Procesando cobro…
                } @else {
                  💵 Cobrar {{ estimatedTotal() | bolivianos }} en Efectivo
                }
              </button>
            </div>
          </footer>
        </div>
      }
    </section>
  `,
})
export class PosSalesAdmin {
  private readonly commerce = inject(CommerceService);
  private readonly catalog = inject(CatalogService);
  private readonly auth = inject(AuthService);
  private readonly errors = inject(ApiErrorService);

  readonly branches = signal<Branch[]>([]);
  readonly products = signal<Product[]>([]);
  readonly lines = signal<SaleLine[]>([]);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly completed = signal<Sale | null>(null);

  // Branch signals
  readonly selectedBranchId = signal<number | null>(null);

  // Cascading selector signals
  readonly selectedBrandId = signal<number | null>(null);
  readonly selectedProductId = signal<number | null>(null);
  readonly selectedSize = signal<string>('');
  readonly selectedVariantId = signal<number | null>(null);
  readonly quantity = signal<number>(1);

  // Quick scanner signals
  readonly barcodeQuery = signal<string>('');
  readonly barcodeMatchNotice = signal<string>('');

  readonly currentUser = this.auth.currentUser;

  readonly canSelectBranch = computed(() => {
    const u = this.currentUser();
    if (!u) return false;
    return u.roles.includes('ADMIN') || !u.id_sucursal;
  });

  readonly assignedBranchName = computed(() => {
    const u = this.currentUser();
    if (u?.sucursal) return u.sucursal;
    if (u?.id_sucursal) {
      const b = this.branches().find((br) => br.id_sucursal === u.id_sucursal);
      return b ? b.nombre : `Sucursal #${u.id_sucursal}`;
    }
    return 'Sucursal asignada';
  });

  readonly brands = computed(() => {
    const map = new Map<number, string>();
    for (const p of this.products()) {
      if (p.id_marca && p.marca) {
        map.set(p.id_marca, p.marca);
      }
    }
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  readonly productsForBrand = computed(() => {
    const brandId = this.selectedBrandId();
    if (!brandId) return [];
    return this.products().filter((p) => p.id_marca === brandId);
  });

  readonly selectedProduct = computed(() => {
    const prodId = this.selectedProductId();
    if (!prodId) return null;
    return this.products().find((p) => p.id_producto === prodId) ?? null;
  });

  readonly availableSizes = computed(() => {
    const prod = this.selectedProduct();
    if (!prod) return [];
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    const unique = Array.from(
      new Set(prod.variantes.filter((v) => v.activo).map((v) => v.talla)),
    );
    return unique.sort((a, b) => {
      const ia = sizeOrder.indexOf(a);
      const ib = sizeOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      return a.localeCompare(b);
    });
  });

  readonly availableVariantsForSize = computed(() => {
    const prod = this.selectedProduct();
    const size = this.selectedSize();
    if (!prod || !size) return [];
    return prod.variantes.filter((v) => v.activo && v.talla === size);
  });

  readonly selectedVariant = computed(() => {
    const variantId = this.selectedVariantId();
    if (!variantId) return null;
    const prod = this.selectedProduct();
    if (prod) {
      const found = prod.variantes.find((v) => v.id_variante === variantId);
      if (found) return found;
    }
    for (const p of this.products()) {
      const found = p.variantes.find((v) => v.id_variante === variantId);
      if (found) return found;
    }
    return null;
  });

  readonly selectedStock = computed(() => {
    const v = this.selectedVariant();
    if (!v) return 0;
    return v.stock_disponible ?? 0;
  });

  readonly canAddCurrentVariant = computed(() => {
    const v = this.selectedVariant();
    if (!v) return false;
    const stock = v.stock_disponible ?? 0;
    const qty = this.quantity();
    return stock > 0 && qty > 0 && qty <= stock;
  });

  readonly currentItemSubtotal = computed(() => {
    const p = this.selectedProduct();
    if (!p || !this.selectedVariantId()) return 0;
    return Number(p.precio_actual || 0) * this.quantity();
  });

  readonly estimatedTotal = computed(() =>
    this.lines().reduce(
      (total, item) => total + Number(item.product.precio_actual || 0) * item.quantity,
      0,
    ),
  );

  constructor() {
    this.catalog.branches().subscribe({
      next: (branches) => {
        this.branches.set(branches);
        this.initBranchContext();
      },
      error: (error) => this.error.set(this.errors.message(error, 'No pudimos preparar la venta.')),
    });

    effect(() => {
      const user = this.auth.currentUser();
      if (user && this.branches().length && !this.selectedBranchId()) {
        this.initBranchContext();
      }
    });
  }

  private initBranchContext(): void {
    const user = this.currentUser();
    const branches = this.branches();
    if (!branches.length) return;

    const canSelect = !user?.id_sucursal || user.roles.includes('ADMIN');

    if (!canSelect && user?.id_sucursal) {
      this.selectedBranchId.set(user.id_sucursal);
      this.loadProducts(user.id_sucursal);
    } else {
      const defaultBranchId = this.selectedBranchId() || user?.id_sucursal || branches[0]?.id_sucursal || null;
      if (defaultBranchId) {
        this.selectedBranchId.set(defaultBranchId);
        this.loadProducts(defaultBranchId);
      } else {
        this.loadProducts();
      }
    }
  }

  private loadProducts(branchId?: number): void {
    const filters: { page_size: number; activo: boolean; sucursal?: number } = {
      page_size: 100,
      activo: true,
    };
    if (branchId) {
      filters.sucursal = branchId;
    }
    this.catalog.products(filters).subscribe({
      next: (data) => {
        this.products.set(data.items);
      },
      error: (error) => this.error.set(this.errors.message(error, 'No pudimos cargar las existencias.')),
    });
  }

  onBranchChange(branchIdStr: string): void {
    const branchId = branchIdStr ? Number(branchIdStr) : null;
    this.selectedBranchId.set(branchId);
    if (this.lines().length > 0) {
      this.lines.set([]);
      this.error.set('La sucursal cambió. El ticket fue reiniciado para reflejar el stock correspondiente.');
    }
    this.clearSelection();
    if (branchId) {
      this.loadProducts(branchId);
    }
  }

  onBrandChange(brandIdStr: string): void {
    const brandId = brandIdStr ? Number(brandIdStr) : null;
    this.selectedBrandId.set(brandId);
    this.selectedProductId.set(null);
    this.selectedSize.set('');
    this.selectedVariantId.set(null);
    this.quantity.set(1);
    this.barcodeMatchNotice.set('');
  }

  onProductChange(productIdStr: string): void {
    const prodId = productIdStr ? Number(productIdStr) : null;
    this.selectedProductId.set(prodId);
    this.selectedSize.set('');
    this.selectedVariantId.set(null);
    this.quantity.set(1);
    this.barcodeMatchNotice.set('');

    if (prodId) {
      const prod = this.products().find((p) => p.id_producto === prodId);
      if (prod) {
        const uniqueSizes = Array.from(
          new Set(prod.variantes.filter((v) => v.activo).map((v) => v.talla)),
        );
        if (uniqueSizes.length === 1) {
          this.onSizeChange(uniqueSizes[0]);
        }
      }
    }
  }

  onSizeChange(size: string): void {
    this.selectedSize.set(size);
    this.selectedVariantId.set(null);
    this.quantity.set(1);
    this.barcodeMatchNotice.set('');

    const prod = this.selectedProduct();
    if (prod) {
      const matchingVariants = prod.variantes.filter((v) => v.activo && v.talla === size);
      if (matchingVariants.length === 1) {
        this.onVariantChange(String(matchingVariants[0].id_variante));
      }
    }
  }

  onVariantChange(variantIdStr: string): void {
    const variantId = variantIdStr ? Number(variantIdStr) : null;
    this.selectedVariantId.set(variantId);
    this.quantity.set(1);
    this.barcodeMatchNotice.set('');
  }

  onQuantityInput(val: string): void {
    const parsed = parseInt(val, 10);
    const max = this.selectedStock();
    if (isNaN(parsed) || parsed < 1) {
      this.quantity.set(1);
    } else if (max > 0 && parsed > max) {
      this.quantity.set(max);
    } else {
      this.quantity.set(parsed);
    }
  }

  incrementQty(): void {
    const max = this.selectedStock();
    if (max > 0 && this.quantity() < max) {
      this.quantity.update((q) => q + 1);
    }
  }

  decrementQty(): void {
    if (this.quantity() > 1) {
      this.quantity.update((q) => q - 1);
    }
  }

  onBarcodeScan(raw: string): void {
    const query = (raw || '').trim().toLowerCase();
    if (!query) return;

    for (const product of this.products()) {
      for (const variant of product.variantes) {
        if (
          variant.activo &&
          ((variant.codigo_barras && variant.codigo_barras.toLowerCase() === query) ||
            (variant.sku && variant.sku.toLowerCase() === query))
        ) {
          this.selectedBrandId.set(product.id_marca);
          this.selectedProductId.set(product.id_producto);
          this.selectedSize.set(variant.talla);
          this.selectedVariantId.set(variant.id_variante);
          this.quantity.set(1);
          this.barcodeMatchNotice.set(
            `✓ Prenda identificada: ${product.nombre} (Talla ${variant.talla} / ${variant.color})`,
          );
          this.error.set('');
          this.barcodeQuery.set('');
          return;
        }
      }
    }

    this.barcodeMatchNotice.set('');
    this.error.set(`No se encontró ninguna prenda con el código o SKU "${raw}".`);
  }

  clearSelection(): void {
    this.selectedBrandId.set(null);
    this.selectedProductId.set(null);
    this.selectedSize.set('');
    this.selectedVariantId.set(null);
    this.quantity.set(1);
    this.barcodeMatchNotice.set('');
  }

  addLine(): void {
    const prod = this.selectedProduct();
    const variant = this.selectedVariant();
    const qty = this.quantity();
    if (!prod || !variant || qty <= 0) return;

    const available = variant.stock_disponible ?? 0;
    const currentLine = this.lines().find((item) => item.variant.id_variante === variant.id_variante);
    const currentQty = currentLine ? currentLine.quantity : 0;

    if (currentQty + qty > available && available > 0) {
      this.error.set(
        `Stock insuficiente: solo quedan ${available} unidad(es) en esta sucursal (tienes ${currentQty} en el ticket).`,
      );
      return;
    }

    this.lines.update((items) => {
      const existing = items.find((item) => item.variant.id_variante === variant.id_variante);
      return existing
        ? items.map((item) =>
            item.variant.id_variante === variant.id_variante
              ? { ...item, quantity: item.quantity + qty }
              : item,
          )
        : [...items, { product: prod, variant, quantity: qty }];
    });

    this.selectedVariantId.set(null);
    this.quantity.set(1);
    this.barcodeMatchNotice.set('');
    this.error.set('');
  }

  removeLine(id: number): void {
    this.lines.update((items) => items.filter((item) => item.variant.id_variante !== id));
  }

  updateLineQty(variantId: number, delta: number): void {
    this.lines.update((items) =>
      items
        .map((item) => {
          if (item.variant.id_variante === variantId) {
            const newQty = item.quantity + delta;
            const max = item.variant.stock_disponible ?? 999;
            if (newQty > max && max > 0) {
              this.error.set(`Stock máximo disponible alcanzado (${max} unidades).`);
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is SaleLine => item !== null),
    );
  }

  clearTicket(): void {
    this.lines.set([]);
    this.error.set('');
  }

  lineSubtotal(line: SaleLine): number {
    return Number(line.product.precio_actual || 0) * line.quantity;
  }

  confirm(): void {
    const branchId = this.selectedBranchId();
    if (!this.lines().length || !branchId) {
      this.error.set('Debes seleccionar una sucursal y agregar prendas al ticket.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.commerce
      .createPosSale({
        id_sucursal: branchId,
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
          this.clearSelection();
          this.loadProducts(branchId);
        },
        error: (error) => {
          this.error.set(this.errors.message(error, 'No pudimos registrar la venta en caja.'));
        },
      });
  }

  printTicket(): void {
    window.print();
  }

  resetPos(): void {
    this.completed.set(null);
    this.lines.set([]);
    this.clearSelection();
    this.error.set('');
    const branchId = this.selectedBranchId();
    if (branchId) {
      this.loadProducts(branchId);
    }
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
      @if (successMessage()) {
        <div class="admin-notice admin-notice--success" style="display: flex; justify-content: space-between; align-items: center;">
          <span>{{ successMessage() }}</span>
          <button type="button" (click)="successMessage.set('')" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; color: inherit;" aria-label="Cerrar notificación">✕</button>
        </div>
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
                  <!-- Reserva & Creación & Cliente -->
                  <td>
                    <div class="order-id-cell">
                      <span class="order-id-title">Reserva #{{ item.id_reserva }}</span>
                      <span class="order-date-text">{{ item.fecha_reserva | date: 'short' }}</span>
                      @if (item.cliente_nombre) {
                        <div class="order-customer-info">
                          <span class="order-customer-name">👤 {{ item.cliente_nombre }}</span>
                          @if (item.cliente_telefono) {
                            <small class="order-customer-contact">📞 {{ item.cliente_telefono }}</small>
                          } @else if (item.cliente_correo) {
                            <small class="order-customer-contact">✉️ {{ item.cliente_correo }}</small>
                          }
                        </div>
                      }
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
                      @if (canQuickCharge(item)) {
                        <button
                          class="order-quick-pay-btn"
                          type="button"
                          [disabled]="saving()"
                          (click)="openPaymentModal(item)"
                          title="Cobrar en caja y formalizar venta"
                        >
                          💳 Cobrar en caja
                        </button>
                      }
                      @if (primaryAction(item); as act) {
                        <button
                          class="order-primary-btn"
                          type="button"
                          [disabled]="saving()"
                          (click)="handleAction(item, act)"
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

      <!-- Modal de Cobro en Caja / Concretar Venta -->
      @if (checkoutReservation(); as res) {
        <div class="admin-modal-backdrop" (click)="closePaymentModal()">
          <div
            class="admin-modal-card"
            (click)="$event.stopPropagation()"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-modal-title"
          >
            <header class="admin-modal-header">
              <div>
                <span class="admin-modal-kicker">Caja y Facturación Presencial</span>
                <h2 id="checkout-modal-title" class="admin-modal-title">
                  Concretar Venta · Reserva #{{ res.id_reserva }}
                </h2>
                <p class="admin-modal-subtitle">
                  {{ formatBranchName(res.sucursal, res.id_sucursal) }} · {{ res.items.length }} prenda(s) reservada(s)
                </p>
              </div>
              <button
                type="button"
                class="admin-modal-close"
                (click)="closePaymentModal()"
                [disabled]="saving()"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </header>

            <div class="admin-modal-body">
              <!-- Resumen de prendas reservadas -->
              <div class="checkout-summary-section">
                <span class="checkout-section-label">Prendas a facturar y retirar</span>
                <div class="checkout-items-list">
                  @for (line of res.items; track line.id_detalle) {
                    <div class="checkout-item-row">
                      @if (line.imagen_url) {
                        <img [src]="line.imagen_url" [alt]="line.producto" class="checkout-item-thumb" />
                      } @else {
                        <span class="checkout-item-thumb checkout-item-thumb--placeholder">👕</span>
                      }
                      <div class="checkout-item-details">
                        <span class="checkout-item-name">{{ line.producto }}</span>
                        <div class="checkout-item-badges">
                          <span class="checkout-badge-prop">{{ line.color }}</span>
                          <span class="checkout-badge-prop">Talla {{ line.talla }}</span>
                          <span class="checkout-badge-qty">×{{ line.cantidad }}</span>
                        </div>
                      </div>
                      <div class="checkout-item-price">
                        <span class="checkout-subtotal">{{ line.subtotal | bolivianos }}</span>
                        <small class="checkout-unit-price">{{ line.precio_unitario | bolivianos }} c/u</small>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- Banner de Total a Cobrar -->
              <div class="checkout-total-banner">
                <div class="checkout-total-banner__label">
                  <span>TOTAL A COBRAR</span>
                  <small>Prendas reservadas en tienda</small>
                </div>
                <div class="checkout-total-banner__amount">
                  {{ totalEstimated(res) | bolivianos }}
                </div>
              </div>

              <!-- Selector de Método de Pago -->
              <div class="checkout-method-section">
                <span class="checkout-section-label">Método de cobro</span>
                <div class="payment-method-grid">
                  <button
                    type="button"
                    class="payment-method-card"
                    [class.is-selected]="paymentMethod() === 'EFECTIVO'"
                    (click)="paymentMethod.set('EFECTIVO')"
                  >
                    <span class="payment-method-icon">💵</span>
                    <strong class="payment-method-title">Efectivo</strong>
                    <span class="payment-method-desc">Cálculo de cambio</span>
                  </button>
                  <button
                    type="button"
                    class="payment-method-card"
                    [class.is-selected]="paymentMethod() === 'TARJETA'"
                    (click)="paymentMethod.set('TARJETA')"
                  >
                    <span class="payment-method-icon">💳</span>
                    <strong class="payment-method-title">Tarjeta (POS)</strong>
                    <span class="payment-method-desc">Débito / Crédito</span>
                  </button>
                  <button
                    type="button"
                    class="payment-method-card"
                    [class.is-selected]="paymentMethod() === 'QR'"
                    (click)="paymentMethod.set('QR')"
                  >
                    <span class="payment-method-icon">📱</span>
                    <strong class="payment-method-title">Pago QR</strong>
                    <span class="payment-method-desc">Simple / Transferencia</span>
                  </button>
                </div>
              </div>

              <!-- Configuración / Dinámica según Método -->
              @if (paymentMethod() === 'EFECTIVO') {
                <div class="checkout-method-detail cash-detail-box">
                  <div class="cash-input-group">
                    <label for="cash-received-input">Efectivo recibido del cliente (Bs.)</label>
                    <div class="cash-input-wrap">
                      <span class="cash-currency-symbol">Bs.</span>
                      <input
                        id="cash-received-input"
                        type="number"
                        step="1"
                        min="0"
                        class="cash-input"
                        [ngModel]="amountReceived()"
                        (ngModelChange)="amountReceived.set($event)"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <!-- Botones de billetes rápidos -->
                  <div class="cash-quick-buttons">
                    <span class="cash-quick-label">Atajos:</span>
                    <button type="button" class="cash-chip-btn" (click)="setExactCash()">
                      Exacto ({{ totalEstimated(res) | bolivianos }})
                    </button>
                    <button type="button" class="cash-chip-btn" (click)="addCash(10)">+10</button>
                    <button type="button" class="cash-chip-btn" (click)="addCash(20)">+20</button>
                    <button type="button" class="cash-chip-btn" (click)="addCash(50)">+50</button>
                    <button type="button" class="cash-chip-btn" (click)="addCash(100)">+100</button>
                  </div>

                  <!-- Cálculo de vuelto o faltante -->
                  @if (cashShortage() > 0) {
                    <div class="cash-alert cash-alert--shortage">
                      <span class="cash-alert-icon">⚠️</span>
                      <div>
                        <strong>Monto insuficiente</strong>
                        <p>Faltan {{ cashShortage() | bolivianos }} para cubrir el total de la reserva.</p>
                      </div>
                    </div>
                  } @else {
                    <div class="cash-change-display">
                      <span class="cash-change-label">CAMBIO / VUELTO A ENTREGAR:</span>
                      <strong class="cash-change-amount">{{ changeAmount() | bolivianos }}</strong>
                    </div>
                  }
                </div>
              } @else if (paymentMethod() === 'TARJETA') {
                <div class="checkout-method-detail card-detail-box">
                  <div class="pos-info-banner">
                    <span class="pos-icon">💳</span>
                    <p>
                      Pase la tarjeta del cliente por el dispositivo POS físico de la tienda. Una vez aprobada la transacción en el POS, ingrese el número de autorización para auditoría.
                    </p>
                  </div>
                  <div class="ref-input-group">
                    <label for="pos-reference-input">N° de Autorización o Referencia del POS (Opcional)</label>
                    <input
                      id="pos-reference-input"
                      type="text"
                      class="ref-input"
                      placeholder="Ej: POS-94821 o N° de voucher"
                      [ngModel]="cardReference()"
                      (ngModelChange)="cardReference.set($event)"
                    />
                  </div>
                </div>
              } @else if (paymentMethod() === 'QR') {
                <div class="checkout-method-detail qr-detail-box">
                  <div class="qr-info-banner">
                    <span class="qr-icon">📱</span>
                    <div>
                      <strong>Cobro vía Código QR (Simple / Banco)</strong>
                      <p>Muestre el código QR al cliente para que realice la transferencia por el total exacto ({{ totalEstimated(res) | bolivianos }}). Compruebe la recepción en la app del banco antes de confirmar.</p>
                    </div>
                  </div>
                  <div class="ref-input-group">
                    <label for="qr-reference-input">Referencia o N° de Comprobante QR (Opcional)</label>
                    <input
                      id="qr-reference-input"
                      type="text"
                      class="ref-input"
                      placeholder="Ej: TRANSF-55829 o N° de operación bancaria"
                      [ngModel]="qrReference()"
                      (ngModelChange)="qrReference.set($event)"
                    />
                  </div>
                </div>
              }
            </div>

            <footer class="admin-modal-footer">
              <button
                type="button"
                class="admin-modal-btn admin-modal-btn--secondary"
                (click)="closePaymentModal()"
                [disabled]="saving()"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="admin-modal-btn admin-modal-btn--primary"
                (click)="submitPosSale()"
                [disabled]="saving() || (paymentMethod() === 'EFECTIVO' && cashShortage() > 0)"
              >
                @if (saving()) {
                  <span>Registrando venta...</span>
                } @else {
                  <span>✓ Registrar Pago y Concretar ({{ totalEstimated(res) | bolivianos }})</span>
                }
              </button>
            </footer>
          </div>
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
  readonly successMessage = signal<string>('');
  readonly formatBranchName = formatBranchName;

  readonly checkoutReservation = signal<Reservation | null>(null);
  readonly paymentMethod = signal<'EFECTIVO' | 'TARJETA' | 'QR'>('EFECTIVO');
  readonly amountReceived = signal<number>(0);
  readonly cardReference = signal<string>('');
  readonly qrReference = signal<string>('');

  readonly changeAmount = computed(() => {
    const res = this.checkoutReservation();
    if (!res) return 0;
    const total = this.totalEstimated(res);
    const received = Number(this.amountReceived()) || 0;
    return Math.max(0, received - total);
  });

  readonly cashShortage = computed(() => {
    const res = this.checkoutReservation();
    if (!res) return 0;
    const total = this.totalEstimated(res);
    const received = Number(this.amountReceived()) || 0;
    return Math.max(0, total - received);
  });

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
        const customerMatch =
          (r.cliente_nombre || '').toLowerCase().includes(search) ||
          (r.cliente_correo || '').toLowerCase().includes(search) ||
          (r.cliente_telefono || '').toLowerCase().includes(search);
        return idMatch || branchMatch || itemsMatch || addressMatch || customerMatch;
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

  canQuickCharge(item: Reservation): boolean {
    return ['PREPARANDO', 'LISTA'].includes(item.estado);
  }

  handleAction(item: Reservation, act: { targetState: string; label: string }): void {
    if (act.targetState === 'CONVERTIDA') {
      this.openPaymentModal(item);
    } else {
      this.update(item.id_reserva, act.targetState);
    }
  }

  openPaymentModal(res: Reservation): void {
    this.checkoutReservation.set(res);
    this.paymentMethod.set('EFECTIVO');
    const total = this.totalEstimated(res);
    this.amountReceived.set(total);
    this.cardReference.set('');
    this.qrReference.set('');
    this.error.set('');
  }

  closePaymentModal(): void {
    if (this.saving()) return;
    this.checkoutReservation.set(null);
  }

  setExactCash(): void {
    const res = this.checkoutReservation();
    if (!res) return;
    this.amountReceived.set(this.totalEstimated(res));
  }

  addCash(extra: number): void {
    const current = Number(this.amountReceived()) || 0;
    this.amountReceived.set(current + extra);
  }

  paymentMethodLabel(m: 'EFECTIVO' | 'TARJETA' | 'QR'): string {
    switch (m) {
      case 'EFECTIVO':
        return 'Efectivo';
      case 'TARJETA':
        return 'Tarjeta (POS)';
      case 'QR':
        return 'Pago QR';
    }
  }

  submitPosSale(): void {
    const res = this.checkoutReservation();
    if (!res) return;

    const method = this.paymentMethod();
    const total = this.totalEstimated(res);
    const received = Number(this.amountReceived()) || 0;

    if (method === 'EFECTIVO' && received < total) {
      this.error.set(
        `El monto recibido (Bs. ${received.toFixed(2)}) es insuficiente para cubrir el total (Bs. ${total.toFixed(2)}).`,
      );
      return;
    }

    let ref: string | null = null;
    if (method === 'TARJETA') {
      ref = this.cardReference().trim() || null;
    } else if (method === 'QR') {
      ref = this.qrReference().trim() || null;
    }

    const payload = {
      id_sucursal: res.id_sucursal,
      id_reserva: res.id_reserva,
      modalidad_entrega: 'ENTREGA_DIRECTA',
      items: res.items.map((line) => ({
        id_variante: line.id_variante,
        cantidad: line.cantidad,
      })),
      registrar_efectivo: true,
      metodo_pago: method,
      referencia_pago: ref,
    };

    this.saving.set(true);
    this.error.set('');

    this.commerce
      .createPosSale(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (sale) => {
          this.checkoutReservation.set(null);
          const saleId = sale.id_venta ? ` #${sale.id_venta}` : '';
          this.successMessage.set(
            `¡Venta${saleId} registrada con éxito mediante ${this.paymentMethodLabel(method)}! Stock consumido y reserva finalizada.`,
          );
          this.items.update((items) =>
            items.map((item) =>
              item.id_reserva === res.id_reserva ? { ...item, estado: 'CONVERTIDA' } : item,
            ),
          );
          setTimeout(() => {
            if (this.successMessage().includes(saleId)) {
              this.successMessage.set('');
            }
          }, 8000);
        },
        error: (err) => {
          this.error.set(this.errors.message(err, 'No pudimos registrar la venta en caja.'));
        },
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
          <label for="order-search">Buscar pedido, prenda o cliente</label>
          <input
            id="order-search"
            type="search"
            placeholder="Ej: #12, Cliente, Polo, Verde, Central..."
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
                  <!-- Pedido & Fecha & Cliente -->
                  <td>
                    <div class="order-id-cell">
                      <span class="order-id-title">Pedido #{{ item.id_pedido }}</span>
                      <span class="order-date-text">{{ item.fecha_creacion | date: 'short' }}</span>
                      @if (item.cliente_nombre) {
                        <div class="order-customer-info">
                          <span class="order-customer-name">👤 {{ item.cliente_nombre }}</span>
                          @if (item.cliente_telefono) {
                            <small class="order-customer-contact">📞 {{ item.cliente_telefono }}</small>
                          } @else if (item.cliente_correo) {
                            <small class="order-customer-contact">✉️ {{ item.cliente_correo }}</small>
                          }
                        </div>
                      }
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
        const customerMatch =
          (o.cliente_nombre || '').toLowerCase().includes(search) ||
          (o.cliente_correo || '').toLowerCase().includes(search) ||
          (o.cliente_telefono || '').toLowerCase().includes(search);
        return idMatch || branchMatch || itemsMatch || addressMatch || customerMatch;
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
