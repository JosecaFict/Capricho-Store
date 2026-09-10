import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { Branch } from '../../core/models/catalog.model';
import {
  Address,
  Cart,
  OperationalNotification,
  Order,
  Reservation,
  ReturnRequest,
  Sale,
  ShippingQuote,
} from '../../core/models/commerce.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CommerceService } from '../../core/services/commerce.service';
import { StatusPanel } from '../../shared/components/status-panel/status-panel';
import { BolivianosPipe } from '../../shared/pipes/bolivianos.pipe';

@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, BolivianosPipe, StatusPanel],
  template: `
    <section class="commerce-page page-shell">
      <header class="commerce-heading">
        <div>
          <h1>Tu carrito</h1>
          <p>Revisa variantes y cantidades antes de continuar.</p>
        </div>
        @if (cart()?.items?.length) {
          <button
            class="button button--quiet"
            type="button"
            [disabled]="saving()"
            (click)="clear()"
          >
            Vaciar carrito
          </button>
        }
      </header>
      @if (loading()) {
        <div class="commerce-skeleton" aria-label="Cargando carrito">
          <span></span><span></span>
        </div>
      } @else if (error()) {
        <app-status-panel
          kind="error"
          title="No pudimos cargar tu carrito"
          [message]="error()"
          (retry)="load()"
        />
      } @else if (!cart()?.items?.length) {
        <app-status-panel
          title="Tu carrito está vacío"
          message="Explora el catálogo y elige una talla y color disponibles."
        />
        <div class="commerce-empty-action">
          <a class="button button--primary" routerLink="/catalogo">Ver catálogo</a>
        </div>
      } @else if (cart(); as current) {
        <div class="commerce-layout">
          <div class="commerce-lines" aria-live="polite">
            @for (item of current.items; track item.id_detalle) {
              <article
                class="commerce-line"
                [class.is-unavailable]="!item.activo || item.stock_disponible < item.cantidad"
              >
                <img
                  [src]="item.imagen_url || '/images/catalogo-prendas-oficiales.jpg'"
                  [alt]="item.producto"
                />
                <div class="commerce-line__body">
                  <h2>{{ item.producto }}</h2>
                  <p>{{ item.color }} / Talla {{ item.talla }}</p>
                  @if (!item.activo) {
                    <strong class="field-error">Variante inactiva</strong>
                  } @else if (item.stock_disponible < item.cantidad) {
                    <strong class="field-error"
                      >Solo quedan {{ item.stock_disponible }} unidades</strong
                    >
                  }
                </div>
                <label class="field commerce-quantity">
                  <span>Cantidad</span>
                  <input
                    type="number"
                    min="1"
                    [max]="item.stock_disponible"
                    [value]="item.cantidad"
                    [disabled]="saving()"
                    (change)="changeQuantity(item.id_detalle, $event)"
                  />
                </label>
                <div class="commerce-line__price">
                  <strong>{{ item.subtotal | bolivianos }}</strong>
                  <button
                    class="text-button"
                    type="button"
                    [disabled]="saving()"
                    (click)="remove(item.id_detalle)"
                  >
                    Quitar
                  </button>
                </div>
              </article>
            }
          </div>
          <aside class="commerce-summary" aria-label="Resumen del carrito">
            <h2>Resumen</h2>
            <div>
              <span>Productos</span><strong>{{ current.items.length }}</strong>
            </div>
            <div class="commerce-summary__total">
              <span>Total</span><strong>{{ current.total | bolivianos }}</strong>
            </div>
            <a class="button button--primary button--full" routerLink="/checkout"
              >Continuar compra</a
            >
            <a class="button button--secondary button--full" routerLink="/reservas"
              >Reservar para probar</a
            >
            <p>La reserva aparta stock sin registrar una compra.</p>
          </aside>
        </div>
      }
    </section>
  `,
})
export class CartPage {
  private readonly commerce = inject(CommerceService);
  private readonly errors = inject(ApiErrorService);
  readonly cart = signal<Cart | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');

  constructor() {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.commerce
      .cart()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (cart) => this.cart.set(cart),
        error: (error) => this.error.set(this.errors.message(error, 'Intenta nuevamente.')),
      });
  }
  changeQuantity(id: number, event: Event): void {
    const quantity = Number((event.target as HTMLInputElement).value);
    if (!Number.isInteger(quantity) || quantity < 1) return;
    this.mutate(this.commerce.updateCartItem(id, quantity));
  }
  remove(id: number): void {
    this.mutate(this.commerce.removeCartItem(id));
  }
  clear(): void {
    this.mutate(this.commerce.clearCart());
  }
  private mutate(request: ReturnType<CommerceService['clearCart']>): void {
    this.saving.set(true);
    this.error.set('');
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (cart) => this.cart.set(cart),
      error: (error) =>
        this.error.set(this.errors.message(error, 'No pudimos actualizar el carrito.')),
    });
  }
}

@Component({
  selector: 'app-checkout-page',
  imports: [ReactiveFormsModule, RouterLink, BolivianosPipe, StatusPanel],
  template: `
    <section class="commerce-page page-shell">
      <a class="back-link" routerLink="/carrito">Volver al carrito</a>
      <header class="commerce-heading">
        <div>
          <h1>Confirmar pedido</h1>
          <p>Elige cómo recibirás tus prendas.</p>
        </div>
      </header>
      @if (loading()) {
        <div class="commerce-skeleton"><span></span><span></span></div>
      } @else if (error()) {
        <app-status-panel
          kind="error"
          title="No pudimos preparar el checkout"
          [message]="error()"
          (retry)="load()"
        />
      } @else if (completed(); as order) {
        <app-status-panel
          title="Pedido registrado"
          [message]="
            'Tu número de pedido es #' +
            order.id_pedido +
            '. Puedes seguir su estado desde tu cuenta.'
          "
        />
        <div class="commerce-empty-action">
          <a class="button button--primary" routerLink="/pedidos">Ver pedido</a>
        </div>
      } @else if (cart(); as current) {
        <form class="commerce-layout" [formGroup]="form" (ngSubmit)="submit()">
          <div class="checkout-form">
            <fieldset class="delivery-choice">
              <legend>Modalidad de entrega</legend>
              <label
                ><input
                  type="radio"
                  formControlName="modalidad_entrega"
                  value="RETIRO_SUCURSAL"
                  (change)="quote.set(null)"
                /><span
                  ><strong>Retiro en sucursal</strong
                  ><small>Te avisaremos cuando esté listo.</small></span
                ></label
              >
              <label
                ><input
                  type="radio"
                  formControlName="modalidad_entrega"
                  value="DELIVERY"
                  (change)="quote.set(null)"
                /><span
                  ><strong>Delivery</strong><small>Requiere dirección con coordenadas.</small></span
                ></label
              >
            </fieldset>
            <label class="field"
              ><span>Sucursal que prepara el pedido</span
              ><select formControlName="id_sucursal" (change)="quote.set(null)">
                <option value="">Selecciona una sucursal</option>
                @for (branch of branches(); track branch.id_sucursal) {
                  <option [value]="branch.id_sucursal">
                    {{ branch.nombre }} / {{ branch.direccion }}
                  </option>
                }
              </select></label
            >
            @if (form.controls.modalidad_entrega.value === 'DELIVERY') {
              <label class="field"
                ><span>Dirección de entrega</span
                ><select formControlName="id_direccion" (change)="quote.set(null)">
                  <option value="">Selecciona una dirección</option>
                  @for (address of addresses(); track address.id_direccion) {
                    <option [value]="address.id_direccion">
                      {{ address.alias || address.direccion }} / {{ address.ciudad }}
                    </option>
                  }
                </select></label
              >
              @if (!addresses().length) {
                <p class="notice notice--warning">
                  Primero registra una dirección con coordenadas desde tu cuenta.
                </p>
              }
              <button
                class="button button--secondary"
                type="button"
                [disabled]="quoting() || !canQuote()"
                (click)="requestQuote()"
              >
                {{ quoting() ? 'Cotizando…' : 'Cotizar envío' }}
              </button>
              @if (quote(); as currentQuote) {
                <div class="shipping-quote">
                  <span>Distancia estimada {{ currentQuote.distancia_km }} km</span
                  ><strong>{{ currentQuote.costo_estimado | bolivianos }}</strong
                  ><small
                    >Estimación en línea recta. Google Routes se integrará en otra etapa.</small
                  >
                </div>
              }
            }
          </div>
          <aside class="commerce-summary">
            <h2>Tu pedido</h2>
            @for (item of current.items; track item.id_detalle) {
              <div>
                <span>{{ item.producto }} × {{ item.cantidad }}</span
                ><strong>{{ item.subtotal | bolivianos }}</strong>
              </div>
            }
            <div class="commerce-summary__total">
              <span>Total productos</span><strong>{{ current.total | bolivianos }}</strong>
            </div>
            @if (quote(); as currentQuote) {
              <div>
                <span>Envío estimado</span
                ><strong>{{ currentQuote.costo_estimado | bolivianos }}</strong>
              </div>
            }
            <button
              class="button button--primary button--full"
              type="submit"
              [disabled]="submitting() || form.invalid || needsQuote()"
            >
              {{ submitting() ? 'Registrando…' : 'Confirmar pedido' }}
            </button>
            <p>No se realizará un cobro digital en este ciclo.</p>
          </aside>
        </form>
      }
    </section>
  `,
})
export class CheckoutPage {
  private readonly fb = inject(FormBuilder);
  private readonly commerce = inject(CommerceService);
  private readonly catalog = inject(CatalogService);
  private readonly errors = inject(ApiErrorService);
  readonly cart = signal<Cart | null>(null);
  readonly branches = signal<Branch[]>([]);
  readonly addresses = signal<Address[]>([]);
  readonly quote = signal<ShippingQuote | null>(null);
  readonly completed = signal<Order | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly quoting = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    modalidad_entrega: ['RETIRO_SUCURSAL', Validators.required],
    id_sucursal: ['', Validators.required],
    id_direccion: [''],
  });
  constructor() {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      cart: this.commerce.cart(),
      branches: this.catalog.branches(),
      addresses: this.commerce.addresses(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ cart, branches, addresses }) => {
          this.cart.set(cart);
          this.branches.set(branches);
          this.addresses.set(addresses);
        },
        error: (error) => this.error.set(this.errors.message(error, 'Intenta nuevamente.')),
      });
  }
  canQuote(): boolean {
    return !!this.form.controls.id_sucursal.value && !!this.form.controls.id_direccion.value;
  }
  needsQuote(): boolean {
    return this.form.controls.modalidad_entrega.value === 'DELIVERY' && !this.quote();
  }
  requestQuote(): void {
    if (!this.canQuote()) return;
    this.quoting.set(true);
    this.error.set('');
    this.commerce
      .quoteShipping(
        Number(this.form.controls.id_sucursal.value),
        Number(this.form.controls.id_direccion.value),
      )
      .pipe(finalize(() => this.quoting.set(false)))
      .subscribe({
        next: (quote) => this.quote.set(quote),
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos calcular el envío.')),
      });
  }
  submit(): void {
    if (this.form.invalid || this.needsQuote()) return;
    this.submitting.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    this.commerce
      .checkout({
        id_sucursal: Number(value.id_sucursal),
        modalidad_entrega: value.modalidad_entrega,
        id_direccion: value.modalidad_entrega === 'DELIVERY' ? Number(value.id_direccion) : null,
        id_cotizacion: this.quote()?.id_cotizacion ?? null,
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (order) => this.completed.set(order),
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos registrar el pedido.')),
      });
  }
}

@Component({
  selector: 'app-reservations-page',
  imports: [ReactiveFormsModule, DatePipe, RouterLink, StatusPanel],
  template: `
    <section class="commerce-page page-shell">
      <header class="commerce-heading">
        <div>
          <h1>Reservas</h1>
          <p>Aparta las prendas de tu carrito para probarlas en una sucursal.</p>
        </div>
      </header>
      @if (error()) {
        <p class="notice notice--error" role="alert">{{ error() }}</p>
      }
      @if (cart()?.items?.length) {
        <form class="reservation-create" [formGroup]="form" (ngSubmit)="create()">
          <div>
            <h2>Nueva reserva</h2>
            <p>{{ cart()!.items.length }} variantes serán apartadas sin pago.</p>
          </div>
          <label class="field"
            ><span>Sucursal</span
            ><select formControlName="id_sucursal">
              <option value="">Selecciona</option>
              @for (branch of branches(); track branch.id_sucursal) {
                <option [value]="branch.id_sucursal">{{ branch.nombre }}</option>
              }
            </select></label
          >
          <label class="field"
            ><span>Fecha y hora de prueba</span
            ><input type="datetime-local" formControlName="fecha_cita"
          /></label>
          <button
            class="button button--primary"
            type="submit"
            [disabled]="saving() || form.invalid"
          >
            {{ saving() ? 'Reservando…' : 'Confirmar reserva' }}
          </button>
        </form>
      } @else if (!loading()) {
        <p class="notice notice--warning">
          Tu carrito está vacío. <a routerLink="/catalogo">Elige prendas del catálogo</a>.
        </p>
      }
      <section class="history-section">
        <h2>Tus reservas</h2>
        @if (loading()) {
          <div class="commerce-skeleton"><span></span></div>
        } @else if (!reservations().length) {
          <app-status-panel
            title="Aún no tienes reservas"
            message="Cuando apartes prendas, podrás seguir su preparación aquí."
          />
        } @else {
          <div class="record-list">
            @for (reservation of reservations(); track reservation.id_reserva) {
              <article>
                <header>
                  <div>
                    <h3>Reserva #{{ reservation.id_reserva }}</h3>
                    <p>
                      {{ reservation.sucursal }} / {{ reservation.fecha_reserva | date: 'medium' }}
                    </p>
                  </div>
                  <span class="status-chip">{{ reservation.estado }}</span>
                </header>
                <p>
                  Prueba:
                  {{
                    reservation.fecha_cita
                      ? (reservation.fecha_cita | date: 'medium')
                      : 'Sin horario solicitado'
                  }}
                </p>
                <ul>
                  @for (item of reservation.items; track item.id_detalle) {
                    <li>
                      {{ item.producto }} / {{ item.color }} / {{ item.talla }} ×
                      {{ item.cantidad }}
                    </li>
                  }
                </ul>
                @if (canCancel(reservation)) {
                  <button
                    class="button button--quiet"
                    type="button"
                    [disabled]="saving()"
                    (click)="cancel(reservation.id_reserva)"
                  >
                    Cancelar reserva
                  </button>
                }
              </article>
            }
          </div>
        }
      </section>
    </section>
  `,
})
export class ReservationsPage {
  private readonly fb = inject(FormBuilder);
  private readonly commerce = inject(CommerceService);
  private readonly catalog = inject(CatalogService);
  private readonly errors = inject(ApiErrorService);
  readonly cart = signal<Cart | null>(null);
  readonly branches = signal<Branch[]>([]);
  readonly reservations = signal<Reservation[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    id_sucursal: ['', Validators.required],
    fecha_cita: ['', Validators.required],
  });
  constructor() {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    forkJoin({
      cart: this.commerce.cart(),
      branches: this.catalog.branches(),
      reservations: this.commerce.reservations(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.cart.set(data.cart);
          this.branches.set(data.branches);
          this.reservations.set(data.reservations);
        },
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos cargar tus reservas.')),
      });
  }
  create(): void {
    if (this.form.invalid || !this.cart()?.items.length) return;
    this.saving.set(true);
    const value = this.form.getRawValue();
    this.commerce
      .createReservation({
        id_sucursal: Number(value.id_sucursal),
        fecha_cita: new Date(value.fecha_cita).toISOString(),
        items: this.cart()!.items.map((item) => ({
          id_variante: item.id_variante,
          cantidad: item.cantidad,
        })),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (item) => {
          this.reservations.update((items) => [item, ...items]);
        },
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos crear la reserva.')),
      });
  }
  canCancel(item: Reservation): boolean {
    return ['PENDIENTE', 'CONFIRMADA', 'PREPARANDO', 'LISTA', 'CLIENTE_PRESENTE'].includes(
      item.estado,
    );
  }
  cancel(id: number): void {
    this.saving.set(true);
    this.commerce
      .cancelReservation(id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) =>
          this.reservations.update((items) =>
            items.map((item) => (item.id_reserva === id ? updated : item)),
          ),
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos cancelar la reserva.')),
      });
  }
}

@Component({
  selector: 'app-orders-page',
  imports: [DatePipe, BolivianosPipe, StatusPanel],
  template: `<section class="commerce-page page-shell">
    <header class="commerce-heading">
      <div>
        <h1>Pedidos</h1>
        <p>Sigue la preparación, el retiro o la entrega.</p>
      </div>
    </header>
    @if (loading()) {
      <div class="commerce-skeleton"><span></span><span></span></div>
    } @else if (error()) {
      <app-status-panel
        kind="error"
        title="No pudimos cargar tus pedidos"
        [message]="error()"
        (retry)="load()"
      />
    } @else if (!orders().length) {
      <app-status-panel
        title="Aún no tienes pedidos"
        message="Tus compras online aparecerán aquí."
      />
    } @else {
      <div class="record-list">
        @for (order of orders(); track order.id_pedido) {
          <article>
            <header>
              <div>
                <h2>Pedido #{{ order.id_pedido }}</h2>
                <p>{{ order.fecha_creacion | date: 'medium' }}</p>
              </div>
              <span class="status-chip">{{ order.estado }}</span>
            </header>
            <dl class="record-facts">
              <div>
                <dt>Modalidad</dt>
                <dd>
                  {{ order.modalidad_entrega === 'DELIVERY' ? 'Delivery' : 'Retiro en sucursal' }}
                </dd>
              </div>
              <div>
                <dt>Lugar</dt>
                <dd>{{ order.direccion_entrega || order.sucursal }}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{{ order.total | bolivianos }}</dd>
              </div>
            </dl>
          </article>
        }
      </div>
    }
  </section>`,
})
export class OrdersPage {
  private readonly commerce = inject(CommerceService);
  private readonly errors = inject(ApiErrorService);
  readonly orders = signal<Order[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  constructor() {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.commerce
      .orders()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (items) => this.orders.set(items),
        error: (error) => this.error.set(this.errors.message(error, 'Intenta nuevamente.')),
      });
  }
}

@Component({
  selector: 'app-addresses-page',
  imports: [ReactiveFormsModule, StatusPanel],
  template: `<section class="commerce-page page-shell">
    <header class="commerce-heading">
      <div>
        <h1>Direcciones</h1>
        <p>Guarda ubicaciones para futuros pedidos con delivery.</p>
      </div>
    </header>
    @if (error()) {
      <p class="notice notice--error">{{ error() }}</p>
    }
    <form class="address-form" [formGroup]="form" (ngSubmit)="save()">
      <label class="field"
        ><span>Nombre</span><input formControlName="alias" placeholder="Casa" /></label
      ><label class="field"
        ><span>Ciudad</span
        ><select formControlName="id_ciudad">
          <option value="">Selecciona</option>
          @for (city of cities(); track city.id_ciudad) {
            <option [value]="city.id_ciudad">{{ city.nombre }}</option>
          }
        </select></label
      ><label class="field field--wide"
        ><span>Dirección</span><input formControlName="direccion" /></label
      ><label class="field"
        ><span>Latitud</span
        ><input type="number" step="0.000001" formControlName="latitud" /></label
      ><label class="field"
        ><span>Longitud</span
        ><input type="number" step="0.000001" formControlName="longitud" /></label
      ><label class="check-field field--wide"
        ><input type="checkbox" formControlName="es_principal" /> Dirección principal</label
      ><button class="button button--primary" type="submit" [disabled]="saving() || form.invalid">
        {{ saving() ? 'Guardando…' : editingId() ? 'Actualizar dirección' : 'Guardar dirección' }}
      </button>
      @if (editingId()) {
        <button class="button button--ghost" type="button" (click)="cancelEdit()">Cancelar</button>
      }
    </form>
    <section class="history-section">
      <h2>Direcciones guardadas</h2>
      @if (!loading() && !addresses().length) {
        <app-status-panel
          title="Sin direcciones"
          message="Agrega una dirección para cotizar delivery."
        />
      } @else {
        <div class="record-list record-list--compact">
          @for (address of addresses(); track address.id_direccion) {
            <article>
              <header>
                <div>
                  <h3>{{ address.alias || 'Dirección' }}</h3>
                  <p>{{ address.direccion }}, {{ address.ciudad }}</p>
                </div>
                @if (address.es_principal) {
                  <span class="status-chip">Principal</span>
                }
              </header>
              <button class="button button--ghost" type="button" (click)="edit(address)">
                Editar
              </button>
            </article>
          }
        </div>
      }
    </section>
  </section>`,
})
export class AddressesPage {
  private readonly fb = inject(FormBuilder);
  private readonly commerce = inject(CommerceService);
  private readonly catalog = inject(CatalogService);
  private readonly errors = inject(ApiErrorService);
  readonly addresses = signal<Address[]>([]);
  readonly cities = signal<Array<{ id_ciudad: number; nombre: string }>>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    alias: [''],
    id_ciudad: ['', Validators.required],
    direccion: ['', [Validators.required, Validators.minLength(3)]],
    latitud: ['', Validators.required],
    longitud: ['', Validators.required],
    es_principal: [false],
  });
  constructor() {
    forkJoin({ addresses: this.commerce.addresses(), cities: this.catalog.cities() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.addresses.set(data.addresses);
          this.cities.set(data.cities);
        },
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos cargar las direcciones.')),
      });
  }
  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const value = this.form.getRawValue();
    const payload = {
      ...value,
      id_ciudad: Number(value.id_ciudad),
      latitud: Number(value.latitud),
      longitud: Number(value.longitud),
    };
    const editingId = this.editingId();
    const request = editingId
      ? this.commerce.updateAddress(editingId, payload)
      : this.commerce.createAddress(payload);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (address) => {
        this.addresses.update((items) =>
          editingId
            ? items.map((item) => (item.id_direccion === editingId ? address : item))
            : [address, ...items],
        );
        this.cancelEdit();
      },
      error: (error) =>
        this.error.set(this.errors.message(error, 'No pudimos guardar la dirección.')),
    });
  }
  edit(address: Address): void {
    this.editingId.set(address.id_direccion);
    this.form.setValue({
      alias: address.alias ?? '',
      id_ciudad: String(address.id_ciudad),
      direccion: address.direccion,
      latitud: address.latitud ?? '',
      longitud: address.longitud ?? '',
      es_principal: address.es_principal,
    });
  }
  cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({
      alias: '',
      id_ciudad: '',
      direccion: '',
      latitud: '',
      longitud: '',
      es_principal: false,
    });
  }
}

@Component({
  selector: 'app-history-page',
  imports: [DatePipe, BolivianosPipe, ReactiveFormsModule, StatusPanel],
  template: `<section class="commerce-page page-shell">
    <header class="commerce-heading">
      <div>
        <h1>Historial</h1>
        <p>Compras, reservas y devoluciones en un solo lugar.</p>
      </div>
    </header>
    <div class="commerce-tabs" role="tablist">
      <button type="button" [class.active]="tab() === 'compras'" (click)="tab.set('compras')">
        Compras</button
      ><button type="button" [class.active]="tab() === 'reservas'" (click)="tab.set('reservas')">
        Reservas</button
      ><button
        type="button"
        [class.active]="tab() === 'devoluciones'"
        (click)="tab.set('devoluciones')"
      >
        Devoluciones
      </button>
    </div>
    @if (error()) {
      <p class="notice notice--error">{{ error() }}</p>
    }
    @if (loading()) {
      <div class="commerce-skeleton"><span></span></div>
    } @else if (tab() === 'compras') {
      <div class="record-list">
        @for (sale of sales(); track sale.id_venta) {
          <article>
            <header>
              <div>
                <h2>Compra #{{ sale.id_venta }}</h2>
                <p>{{ sale.fecha_venta | date: 'medium' }} / {{ sale.sucursal }}</p>
              </div>
              <strong>{{ sale.total | bolivianos }}</strong>
            </header>
            <ul>
              @for (item of sale.items; track item.id_detalle) {
                <li>
                  {{ item.producto }} / {{ item.color }} / {{ item.talla }} × {{ item.cantidad }}
                </li>
              }
            </ul>
            <button class="button button--quiet" type="button" (click)="startReturn(sale)">
              Solicitar devolución
            </button>
            @if (returnSale()?.id_venta === sale.id_venta) {
              <form class="return-form" [formGroup]="returnForm" (ngSubmit)="submitReturn()">
                <label class="field"
                  ><span>Artículo</span
                  ><select formControlName="id_detalle_venta">
                    @for (item of sale.items; track item.id_detalle) {
                      <option [value]="item.id_detalle">
                        {{ item.producto }} / {{ item.talla }}
                      </option>
                    }
                  </select></label
                ><label class="field"
                  ><span>Cantidad</span
                  ><input type="number" min="1" formControlName="cantidad" /></label
                ><label class="field field--wide"
                  ><span>Motivo</span><input formControlName="motivo" /></label
                ><button
                  class="button button--primary"
                  type="submit"
                  [disabled]="saving() || returnForm.invalid"
                >
                  Enviar solicitud
                </button>
              </form>
            }
          </article>
        } @empty {
          <app-status-panel title="Sin compras" message="Todavía no registraste compras." />
        }
      </div>
    } @else if (tab() === 'reservas') {
      <div class="record-list">
        @for (item of reservations(); track item.id_reserva) {
          <article>
            <header>
              <div>
                <h2>Reserva #{{ item.id_reserva }}</h2>
                <p>{{ item.fecha_reserva | date: 'medium' }} / {{ item.sucursal }}</p>
              </div>
              <span class="status-chip">{{ item.estado }}</span>
            </header>
          </article>
        } @empty {
          <app-status-panel title="Sin reservas" message="Todavía no registraste reservas." />
        }
      </div>
    } @else {
      <div class="record-list">
        @for (item of returns(); track item.id_devolucion) {
          <article>
            <header>
              <div>
                <h2>Devolución #{{ item.id_devolucion }}</h2>
                <p>Compra #{{ item.id_venta }} / {{ item.fecha_solicitud | date: 'medium' }}</p>
              </div>
              <span class="status-chip">{{ item.estado }}</span>
            </header>
            <p>{{ item.motivo }}</p>
          </article>
        } @empty {
          <app-status-panel
            title="Sin devoluciones"
            message="No tienes solicitudes de devolución."
          />
        }
      </div>
    }
  </section>`,
})
export class HistoryPage {
  private readonly fb = inject(FormBuilder);
  private readonly commerce = inject(CommerceService);
  private readonly errors = inject(ApiErrorService);
  readonly tab = signal<'compras' | 'reservas' | 'devoluciones'>('compras');
  readonly sales = signal<Sale[]>([]);
  readonly reservations = signal<Reservation[]>([]);
  readonly returns = signal<ReturnRequest[]>([]);
  readonly returnSale = signal<Sale | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly returnForm = this.fb.nonNullable.group({
    id_detalle_venta: ['', Validators.required],
    cantidad: [1, [Validators.required, Validators.min(1)]],
    motivo: ['', [Validators.required, Validators.minLength(3)]],
  });
  constructor() {
    forkJoin({
      sales: this.commerce.purchaseHistory(),
      reservations: this.commerce.reservations(),
      returns: this.commerce.returns(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.sales.set(data.sales);
          this.reservations.set(data.reservations);
          this.returns.set(data.returns);
        },
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos cargar el historial.')),
      });
  }
  startReturn(sale: Sale): void {
    this.returnSale.set(sale);
    this.returnForm.reset({
      id_detalle_venta: String(sale.items[0]?.id_detalle ?? ''),
      cantidad: 1,
      motivo: '',
    });
  }
  submitReturn(): void {
    const sale = this.returnSale();
    if (!sale || this.returnForm.invalid) return;
    this.saving.set(true);
    const value = this.returnForm.getRawValue();
    this.commerce
      .createReturn({
        id_venta: sale.id_venta,
        motivo: value.motivo,
        items: [
          {
            id_detalle_venta: Number(value.id_detalle_venta),
            cantidad: value.cantidad,
            estado_prenda: 'APTA_REINGRESO',
          },
        ],
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (item) => {
          this.returns.update((items) => [item, ...items]);
          this.tab.set('devoluciones');
          this.returnSale.set(null);
        },
        error: (error) =>
          this.error.set(this.errors.message(error, 'No pudimos crear la devolución.')),
      });
  }
}

@Component({
  selector: 'app-notifications-page',
  imports: [DatePipe, StatusPanel],
  template: `<section class="commerce-page page-shell">
    <header class="commerce-heading">
      <div>
        <h1>Notificaciones</h1>
        <p>Cambios operativos de tus reservas, pedidos y devoluciones.</p>
      </div>
    </header>
    @if (loading()) {
      <div class="commerce-skeleton"><span></span></div>
    } @else if (!items().length) {
      <app-status-panel
        title="Sin notificaciones"
        message="Los cambios importantes aparecerán aquí."
      />
    } @else {
      <div class="notification-list">
        @for (item of items(); track item.id_notificacion) {
          <article>
            <div>
              <h2>{{ item.titulo || 'Actualización' }}</h2>
              <p>{{ item.contenido }}</p>
            </div>
            <time [attr.datetime]="item.fecha_creacion">{{
              item.fecha_creacion | date: 'short'
            }}</time>
          </article>
        }
      </div>
    }
  </section>`,
})
export class NotificationsPage {
  private readonly commerce = inject(CommerceService);
  readonly items = signal<OperationalNotification[]>([]);
  readonly loading = signal(true);
  constructor() {
    this.commerce
      .notifications()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: (items) => this.items.set(items) });
  }
}
