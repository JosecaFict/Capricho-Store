import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '../config/api.config';
import {
  Address,
  Cart,
  OperationalNotification,
  Order,
  Reservation,
  ReturnRequest,
  Sale,
  ShippingQuote,
  StripeCheckoutSession,
  StripeCheckoutStatus,
  SupplierPurchaseHistoryPage,
} from '../models/commerce.model';

type Params = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: 'root' })
export class CommerceService {
  private readonly http = inject(HttpClient);

  private params(values?: Params): HttpParams {
    let params = new HttpParams();
    Object.entries(values ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return params;
  }

  cart() {
    return this.http.get<Cart>(`${API_BASE_URL}/cart`);
  }
  addCartItem(id_variante: number, cantidad = 1, id_sucursal?: number | null) {
    const payload: { id_variante: number; cantidad: number; id_sucursal?: number } = {
      id_variante,
      cantidad,
    };
    if (id_sucursal) {
      payload.id_sucursal = id_sucursal;
    }
    return this.http.post<Cart>(`${API_BASE_URL}/cart/items`, payload);
  }
  updateCartItem(id: number, cantidad: number) {
    return this.http.patch<Cart>(`${API_BASE_URL}/cart/items/${id}`, { cantidad });
  }
  removeCartItem(id: number) {
    return this.http.post<Cart>(`${API_BASE_URL}/cart/items/${id}/remove`, {});
  }
  clearCart() {
    return this.http.post<Cart>(`${API_BASE_URL}/cart/clear`, {});
  }
  addresses() {
    return this.http.get<Address[]>(`${API_BASE_URL}/addresses`);
  }
  createAddress(payload: object) {
    return this.http.post<Address>(`${API_BASE_URL}/addresses`, payload);
  }
  updateAddress(id: number, payload: object) {
    return this.http.patch<Address>(`${API_BASE_URL}/addresses/${id}`, payload);
  }
  reservations() {
    return this.http.get<Reservation[]>(`${API_BASE_URL}/reservations`);
  }
  createReservation(payload: object) {
    return this.http.post<Reservation>(`${API_BASE_URL}/reservations`, payload);
  }
  cancelReservation(id: number) {
    return this.http.post<Reservation>(`${API_BASE_URL}/reservations/${id}/cancel`, {});
  }
  checkout(payload: object) {
    return this.http.post<StripeCheckoutSession>(`${API_BASE_URL}/checkout`, payload);
  }
  checkoutStatus(sessionId: string) {
    return this.http.get<StripeCheckoutStatus>(
      `${API_BASE_URL}/checkout/${encodeURIComponent(sessionId)}/status`,
    );
  }
  cancelCheckout(sessionId: string) {
    return this.http.post<void>(
      `${API_BASE_URL}/checkout/${encodeURIComponent(sessionId)}/cancel`,
      {},
    );
  }
  orders() {
    return this.http.get<Order[]>(`${API_BASE_URL}/orders`);
  }
  purchaseHistory() {
    return this.http.get<Sale[]>(`${API_BASE_URL}/history/purchases`);
  }
  quoteShipping(id_sucursal: number, id_direccion: number) {
    return this.http.post<ShippingQuote>(`${API_BASE_URL}/shipping-quotes`, {
      id_sucursal,
      id_direccion,
    });
  }
  returns() {
    return this.http.get<ReturnRequest[]>(`${API_BASE_URL}/returns`);
  }
  createReturn(payload: object) {
    return this.http.post<ReturnRequest>(`${API_BASE_URL}/returns`, payload);
  }
  notifications() {
    return this.http.get<OperationalNotification[]>(`${API_BASE_URL}/notifications`);
  }
  adminReservations(params?: Params) {
    return this.http.get<Reservation[]>(`${API_BASE_URL}/admin/reservations`, {
      params: this.params(params),
    });
  }
  updateReservation(id: number, estado: string) {
    return this.http.patch<Reservation>(`${API_BASE_URL}/admin/reservations/${id}/status`, {
      estado,
    });
  }
  createPosSale(payload: object) {
    return this.http.post<Sale>(`${API_BASE_URL}/sales/pos`, payload);
  }
  adminOrders(params?: Params) {
    return this.http.get<Order[]>(`${API_BASE_URL}/admin/orders`, {
      params: this.params(params),
    });
  }
  updateOrder(id: number, estado: string) {
    return this.http.patch<Order>(`${API_BASE_URL}/admin/orders/${id}/status`, { estado });
  }
  adminReturns() {
    return this.http.get<ReturnRequest[]>(`${API_BASE_URL}/admin/returns`);
  }
  updateReturn(id: number, estado: string) {
    return this.http.patch<ReturnRequest>(`${API_BASE_URL}/admin/returns/${id}/status`, {
      estado,
    });
  }
  supplierPurchaseHistory(params?: Params) {
    return this.http.get<SupplierPurchaseHistoryPage>(`${API_BASE_URL}/supplier-purchase-history`, {
      params: this.params(params),
    });
  }
}
