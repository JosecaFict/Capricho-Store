import 'package:intl/intl.dart';

final _currencyFormatter = NumberFormat.currency(
  symbol: 'Bs ',
  decimalDigits: 2,
);

class CommerceLineItem {
  final int idDetalle;
  final int idVariante;
  final String sku;
  final String producto;
  final String talla;
  final String color;
  final int cantidad;
  final double precioUnitario;
  final double subtotal;
  final int stockDisponible;
  final bool activo;
  final String? imagenUrl;

  const CommerceLineItem({
    required this.idDetalle,
    required this.idVariante,
    required this.sku,
    required this.producto,
    required this.talla,
    required this.color,
    required this.cantidad,
    required this.precioUnitario,
    required this.subtotal,
    required this.stockDisponible,
    required this.activo,
    this.imagenUrl,
  });

  factory CommerceLineItem.fromJson(Map<String, dynamic> json) {
    return CommerceLineItem(
      idDetalle: json['id_detalle'] as int? ?? 0,
      idVariante: json['id_variante'] as int? ?? 0,
      sku: json['sku'] as String? ?? '',
      producto: json['producto'] as String? ?? '',
      talla: json['talla'] as String? ?? '',
      color: json['color'] as String? ?? '',
      cantidad: json['cantidad'] as int? ?? 0,
      precioUnitario: (json['precio_unitario'] as num?)?.toDouble() ?? 0.0,
      subtotal: (json['subtotal'] as num?)?.toDouble() ?? 0.0,
      stockDisponible: json['stock_disponible'] as int? ?? 0,
      activo: json['activo'] as bool? ?? true,
      imagenUrl: json['imagen_url'] as String?,
    );
  }

  String get formattedPrice => _currencyFormatter.format(precioUnitario);
  String get formattedSubtotal => _currencyFormatter.format(subtotal);
}

class Cart {
  final int idCarrito;
  final String estado;
  final int? idSucursal;
  final String? sucursal;
  final List<CommerceLineItem> items;
  final double total;

  const Cart({
    required this.idCarrito,
    required this.estado,
    this.idSucursal,
    this.sucursal,
    required this.items,
    required this.total,
  });

  factory Cart.fromJson(Map<String, dynamic> json) {
    return Cart(
      idCarrito: json['id_carrito'] as int? ?? 0,
      estado: json['estado'] as String? ?? 'ACTIVO',
      idSucursal: json['id_sucursal'] as int?,
      sucursal: json['sucursal'] as String?,
      items: (json['items'] as List<dynamic>?)
              ?.map((e) => CommerceLineItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      total: (json['total'] as num?)?.toDouble() ?? 0.0,
    );
  }

  int get totalQuantity => items.fold(0, (sum, item) => sum + item.cantidad);
  String get formattedTotal => _currencyFormatter.format(total);
  bool get isEmpty => items.isEmpty;
}

class Reservation {
  final int idReserva;
  final int idSucursal;
  final String sucursal;
  final String direccionSucursal;
  final DateTime fechaReserva;
  final DateTime? fechaCita;
  final DateTime? fechaExpiracion;
  final String estado;
  final String? observacion;
  final List<CommerceLineItem> items;

  const Reservation({
    required this.idReserva,
    required this.idSucursal,
    required this.sucursal,
    required this.direccionSucursal,
    required this.fechaReserva,
    this.fechaCita,
    this.fechaExpiracion,
    required this.estado,
    this.observacion,
    required this.items,
  });

  factory Reservation.fromJson(Map<String, dynamic> json) {
    return Reservation(
      idReserva: json['id_reserva'] as int? ?? 0,
      idSucursal: json['id_sucursal'] as int? ?? 0,
      sucursal: json['sucursal'] as String? ?? '',
      direccionSucursal: json['direccion_sucursal'] as String? ?? '',
      fechaReserva: json['fecha_reserva'] != null
          ? DateTime.parse(json['fecha_reserva'] as String)
          : DateTime.now(),
      fechaCita: json['fecha_cita'] != null
          ? DateTime.parse(json['fecha_cita'] as String)
          : null,
      fechaExpiracion: json['fecha_expiracion'] != null
          ? DateTime.parse(json['fecha_expiracion'] as String)
          : null,
      estado: json['estado'] as String? ?? 'PENDIENTE',
      observacion: json['observacion'] as String?,
      items: (json['items'] as List<dynamic>?)
              ?.map((e) => CommerceLineItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  bool get isCancellable =>
      estado == 'PENDIENTE' ||
      estado == 'CONFIRMADA' ||
      estado == 'PREPARANDO' ||
      estado == 'LISTA';

  String get formattedFechaCita {
    if (fechaCita == null) return 'Sin fecha agendada';
    return DateFormat('dd/MM/yyyy HH:mm').format(fechaCita!.toLocal());
  }

  String get formattedFechaExpiracion {
    if (fechaExpiracion == null) return 'No especificada';
    return DateFormat('dd/MM/yyyy HH:mm').format(fechaExpiracion!.toLocal());
  }
}

class Address {
  final int idDireccion;
  final int idCiudad;
  final String ciudad;
  final String? alias;
  final String? zona;
  final String direccion;
  final String? referencia;
  final double? latitud;
  final double? longitud;
  final bool esPrincipal;
  final bool activo;

  const Address({
    required this.idDireccion,
    required this.idCiudad,
    required this.ciudad,
    this.alias,
    this.zona,
    required this.direccion,
    this.referencia,
    this.latitud,
    this.longitud,
    required this.esPrincipal,
    required this.activo,
  });

  factory Address.fromJson(Map<String, dynamic> json) {
    return Address(
      idDireccion: json['id_direccion'] as int? ?? 0,
      idCiudad: json['id_ciudad'] as int? ?? 0,
      ciudad: json['ciudad'] as String? ?? '',
      alias: json['alias'] as String?,
      zona: json['zona'] as String?,
      direccion: json['direccion'] as String? ?? '',
      referencia: json['referencia'] as String?,
      latitud: (json['latitud'] as num?)?.toDouble(),
      longitud: (json['longitud'] as num?)?.toDouble(),
      esPrincipal: json['es_principal'] as bool? ?? false,
      activo: json['activo'] as bool? ?? true,
    );
  }

  String get displayName =>
      alias?.isNotEmpty == true ? alias! : (zona?.isNotEmpty == true ? '$zona, $direccion' : direccion);
}

class ShippingQuote {
  final int idCotizacion;
  final int idSucursal;
  final int idDireccion;
  final double distanciaKm;
  final int? duracionEstimadaMin;
  final double costoEstimado;
  final String proveedorRutas;
  final DateTime fechaCotizacion;
  final DateTime? expiraEn;

  const ShippingQuote({
    required this.idCotizacion,
    required this.idSucursal,
    required this.idDireccion,
    required this.distanciaKm,
    this.duracionEstimadaMin,
    required this.costoEstimado,
    required this.proveedorRutas,
    required this.fechaCotizacion,
    this.expiraEn,
  });

  factory ShippingQuote.fromJson(Map<String, dynamic> json) {
    return ShippingQuote(
      idCotizacion: json['id_cotizacion'] as int? ?? 0,
      idSucursal: json['id_sucursal'] as int? ?? 0,
      idDireccion: json['id_direccion'] as int? ?? 0,
      distanciaKm: (json['distancia_km'] as num?)?.toDouble() ?? 0.0,
      duracionEstimadaMin: json['duracion_estimada_min'] as int?,
      costoEstimado: (json['costo_estimado'] as num?)?.toDouble() ?? 0.0,
      proveedorRutas: json['proveedor_rutas'] as String? ?? 'OPEN_ROUTE_SERVICE',
      fechaCotizacion: json['fecha_cotizacion'] != null
          ? DateTime.parse(json['fecha_cotizacion'] as String)
          : DateTime.now(),
      expiraEn: json['expira_en'] != null
          ? DateTime.parse(json['expira_en'] as String)
          : null,
    );
  }

  String get formattedCost => _currencyFormatter.format(costoEstimado);
  String get formattedDistance => '${distanciaKm.toStringAsFixed(1)} km';
}

class StripeCheckoutResponse {
  final String sessionId;
  final String checkoutUrl;
  final DateTime expiresAt;

  const StripeCheckoutResponse({
    required this.sessionId,
    required this.checkoutUrl,
    required this.expiresAt,
  });

  factory StripeCheckoutResponse.fromJson(Map<String, dynamic> json) {
    return StripeCheckoutResponse(
      sessionId: json['session_id'] as String? ?? '',
      checkoutUrl: json['checkout_url'] as String? ?? '',
      expiresAt: json['expires_at'] != null
          ? DateTime.parse(json['expires_at'] as String)
          : DateTime.now().add(const Duration(hours: 1)),
    );
  }
}

class StripeCheckoutStatusResponse {
  final String status;
  final String message;
  final Order? order;
  final String? receiptUrl;

  const StripeCheckoutStatusResponse({
    required this.status,
    required this.message,
    this.order,
    this.receiptUrl,
  });

  factory StripeCheckoutStatusResponse.fromJson(Map<String, dynamic> json) {
    return StripeCheckoutStatusResponse(
      status: json['status'] as String? ?? 'PROCESANDO',
      message: json['message'] as String? ?? '',
      order: json['order'] != null
          ? Order.fromJson(json['order'] as Map<String, dynamic>)
          : null,
      receiptUrl: json['receipt_url'] as String?,
    );
  }
}

class Order {
  final int idPedido;
  final int idVenta;
  final String estado;
  final String modalidadEntrega;
  final int idSucursal;
  final String sucursal;
  final String direccionSucursal;
  final int? idDireccion;
  final String? direccionEntrega;
  final double total;
  final DateTime fechaCreacion;
  final DateTime? fechaPreparacion;
  final DateTime? fechaFinalizacion;
  final List<CommerceLineItem> items;
  final String? receiptUrl;

  const Order({
    required this.idPedido,
    required this.idVenta,
    required this.estado,
    required this.modalidadEntrega,
    required this.idSucursal,
    required this.sucursal,
    required this.direccionSucursal,
    this.idDireccion,
    this.direccionEntrega,
    required this.total,
    required this.fechaCreacion,
    this.fechaPreparacion,
    this.fechaFinalizacion,
    required this.items,
    this.receiptUrl,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      idPedido: json['id_pedido'] as int? ?? 0,
      idVenta: json['id_venta'] as int? ?? 0,
      estado: json['estado'] as String? ?? 'PENDIENTE',
      modalidadEntrega: json['modalidad_entrega'] as String? ?? 'RETIRO_SUCURSAL',
      idSucursal: json['id_sucursal'] as int? ?? 0,
      sucursal: json['sucursal'] as String? ?? '',
      direccionSucursal: json['direccion_sucursal'] as String? ?? '',
      idDireccion: json['id_direccion'] as int?,
      direccionEntrega: json['direccion_entrega'] as String?,
      total: (json['total'] as num?)?.toDouble() ?? 0.0,
      fechaCreacion: json['fecha_creacion'] != null
          ? DateTime.parse(json['fecha_creacion'] as String)
          : DateTime.now(),
      fechaPreparacion: json['fecha_preparacion'] != null
          ? DateTime.parse(json['fecha_preparacion'] as String)
          : null,
      fechaFinalizacion: json['fecha_finalizacion'] != null
          ? DateTime.parse(json['fecha_finalizacion'] as String)
          : null,
      items: (json['items'] as List<dynamic>?)
              ?.map((e) => CommerceLineItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      receiptUrl: json['receipt_url'] as String?,
    );
  }

  String get formattedTotal => _currencyFormatter.format(total);
  String get formattedDate => DateFormat('dd/MM/yyyy HH:mm').format(fechaCreacion.toLocal());
  bool get isDelivery => modalidadEntrega == 'DELIVERY';

  /// Progreso de seguimiento de 0 a 3
  int get stepProgress {
    switch (estado) {
      case 'PENDIENTE':
        return 0;
      case 'PREPARANDO':
        return 1;
      case 'LISTO_PARA_RETIRO':
      case 'LISTO_PARA_ENVIO':
      case 'RECOGIDO':
      case 'EN_CAMINO':
        return 2;
      case 'ENTREGADO':
      case 'RETIRADO':
        return 3;
      case 'CANCELADO':
        return -1;
      default:
        return 0;
    }
  }

  String get statusDisplay {
    switch (estado) {
      case 'PENDIENTE':
        return 'Pago confirmado / Pendiente';
      case 'PREPARANDO':
        return 'En preparación';
      case 'LISTO_PARA_RETIRO':
        return 'Listo para retiro en tienda';
      case 'LISTO_PARA_ENVIO':
        return 'Listo para despacho';
      case 'RECOGIDO':
      case 'EN_CAMINO':
        return 'En camino con delivery';
      case 'ENTREGADO':
        return 'Entregado con éxito';
      case 'RETIRADO':
        return 'Retirado por el cliente';
      case 'CANCELADO':
        return 'Cancelado';
      default:
        return estado;
    }
  }
}

class CustomerNotification {
  final int idNotificacion;
  final String tipo;
  final String? titulo;
  final String contenido;
  final String estado;
  final DateTime fechaCreacion;

  const CustomerNotification({
    required this.idNotificacion,
    required this.tipo,
    this.titulo,
    required this.contenido,
    required this.estado,
    required this.fechaCreacion,
  });

  factory CustomerNotification.fromJson(Map<String, dynamic> json) {
    return CustomerNotification(
      idNotificacion: json['id_notificacion'] as int? ?? 0,
      tipo: json['tipo'] as String? ?? 'SISTEMA',
      titulo: json['titulo'] as String?,
      contenido: json['contenido'] as String? ?? '',
      estado: json['estado'] as String? ?? 'LEIDO',
      fechaCreacion: json['fecha_creacion'] != null
          ? DateTime.parse(json['fecha_creacion'] as String)
          : DateTime.now(),
    );
  }

  String get formattedDate => DateFormat('dd/MM/yyyy HH:mm').format(fechaCreacion.toLocal());
}
