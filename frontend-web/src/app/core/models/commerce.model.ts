export interface CommerceLine {
  id_detalle: number;
  id_variante: number;
  sku: string;
  producto: string;
  talla: string;
  color: string;
  cantidad: number;
  precio_unitario: string;
  subtotal: string;
  stock_disponible: number;
  activo: boolean;
  imagen_url: string | null;
}

export interface Cart {
  id_carrito: number;
  estado: string;
  items: CommerceLine[];
  total: string;
}

export interface Address {
  id_direccion: number;
  id_ciudad: number;
  ciudad: string;
  alias: string | null;
  zona: string | null;
  direccion: string;
  referencia: string | null;
  latitud: string | null;
  longitud: string | null;
  es_principal: boolean;
  activo: boolean;
}

export interface Reservation {
  id_reserva: number;
  id_sucursal: number;
  sucursal: string;
  direccion_sucursal: string;
  fecha_reserva: string;
  fecha_cita: string | null;
  fecha_expiracion: string | null;
  estado: string;
  observacion: string | null;
  items: CommerceLine[];
}

export interface Sale {
  id_venta: number;
  id_cliente: number | null;
  id_sucursal: number;
  sucursal: string;
  id_empleado: number | null;
  id_reserva: number | null;
  canal_venta: string;
  modalidad_entrega: string;
  estado: string;
  subtotal: string;
  costo_envio: string;
  total: string;
  fecha_venta: string;
  items: CommerceLine[];
}

export interface Order {
  id_pedido: number;
  id_venta: number;
  estado: string;
  modalidad_entrega: 'RETIRO_SUCURSAL' | 'DELIVERY';
  id_sucursal: number;
  sucursal: string;
  direccion_sucursal: string;
  id_direccion: number | null;
  direccion_entrega: string | null;
  total: string;
  fecha_creacion: string;
  fecha_preparacion: string | null;
  fecha_finalizacion: string | null;
  items: CommerceLine[];
}

export interface StripeCheckoutSession {
  session_id: string;
  checkout_url: string;
  expires_at: string;
}

export interface StripeCheckoutStatus {
  status: 'PROCESANDO' | 'PAGADO' | 'CANCELADO' | 'RECHAZADO';
  message: string;
  order: Order | null;
}

export interface ShippingQuote {
  id_cotizacion: number;
  id_sucursal: number;
  id_direccion: number;
  distancia_km: string;
  duracion_estimada_min: number | null;
  costo_estimado: string;
  proveedor_rutas: string;
  fecha_cotizacion: string;
  expira_en: string | null;
}

export interface ReturnRequest {
  id_devolucion: number;
  id_venta: number;
  motivo: string;
  estado: string;
  fecha_solicitud: string;
  fecha_resolucion: string | null;
  items: Array<{
    id_detalle_devolucion: number;
    id_detalle_venta: number;
    id_variante: number;
    producto: string;
    talla: string;
    color: string;
    cantidad: number;
    estado_prenda: string;
  }>;
}

export interface OperationalNotification {
  id_notificacion: number;
  tipo: string;
  titulo: string | null;
  contenido: string;
  estado: string;
  fecha_creacion: string;
}

export interface SupplierPurchaseHistoryPage {
  items: Array<Record<string, string | number | null>>;
  total: number;
  page: number;
  page_size: number;
}
