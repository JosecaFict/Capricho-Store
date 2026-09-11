import 'package:capricho_store/core/network/api_client.dart';
import 'package:capricho_store/core/network/api_exception.dart';
import 'package:capricho_store/features/commerce/domain/commerce_models.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final commerceApiProvider = Provider<CommerceApi>((ref) {
  final dio = ref.watch(dioProvider);
  return CommerceApi(dio);
});

class CommerceApi {
  final Dio _dio;

  CommerceApi(this._dio);

  // -------------------------------------------------------------
  // CARRITO DE COMPRAS (Regla: 1 Carrito = 1 Sucursal)
  // -------------------------------------------------------------
  Future<Cart> getCart() async {
    try {
      final response = await _dio.get('/commerce/cart');
      return Cart.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Cart> addCartItem({
    required int variantId,
    required int quantity,
    int? branchId,
  }) async {
    try {
      final response = await _dio.post(
        '/commerce/cart/items',
        data: {
          'id_variante': variantId,
          'cantidad': quantity,
          if (branchId != null) 'id_sucursal': branchId,
        },
      );
      return Cart.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Cart> updateCartItem({
    required int itemId,
    required int quantity,
  }) async {
    try {
      final response = await _dio.patch(
        '/commerce/cart/items/$itemId',
        data: {'cantidad': quantity},
      );
      return Cart.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Cart> removeCartItem({required int itemId}) async {
    try {
      final response = await _dio.post('/commerce/cart/items/$itemId/remove');
      return Cart.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Cart> clearCart() async {
    try {
      final response = await _dio.post('/commerce/cart/clear');
      return Cart.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // -------------------------------------------------------------
  // DIRECCIONES Y COTIZACIÓN DE ENVÍO (OpenRouteService)
  // -------------------------------------------------------------
  Future<List<Address>> listAddresses() async {
    try {
      final response = await _dio.get('/commerce/addresses');
      final list = response.data as List<dynamic>;
      return list.map((e) => Address.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Address> createAddress({
    required int cityId,
    String? alias,
    String? zone,
    required String address,
    String? reference,
    double? latitude,
    double? longitude,
    bool isMain = false,
  }) async {
    try {
      final response = await _dio.post(
        '/commerce/addresses',
        data: {
          'id_ciudad': cityId,
          if (alias != null && alias.isNotEmpty) 'alias': alias,
          if (zone != null && zone.isNotEmpty) 'zona': zone,
          'direccion': address,
          if (reference != null && reference.isNotEmpty) 'referencia': reference,
          if (latitude != null) 'latitud': latitude,
          if (longitude != null) 'longitud': longitude,
          'es_principal': isMain,
        },
      );
      return Address.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<ShippingQuote> quoteShipping({
    required int branchId,
    required int addressId,
  }) async {
    try {
      final response = await _dio.post(
        '/commerce/shipping-quotes',
        data: {
          'id_sucursal': branchId,
          'id_direccion': addressId,
        },
      );
      return ShippingQuote.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // -------------------------------------------------------------
  // CHECKOUT Y PASARELA STRIPE
  // -------------------------------------------------------------
  Future<StripeCheckoutResponse> checkout({
    required int branchId,
    required String deliveryMode,
    int? addressId,
    int? quoteId,
    String? returnUrl,
  }) async {
    try {
      final response = await _dio.post(
        '/commerce/checkout',
        data: {
          'id_sucursal': branchId,
          'modalidad_entrega': deliveryMode,
          if (addressId != null) 'id_direccion': addressId,
          if (quoteId != null) 'id_cotizacion': quoteId,
          if (returnUrl != null) 'return_url': returnUrl,
        },
      );
      return StripeCheckoutResponse.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<StripeCheckoutStatusResponse> getCheckoutStatus(String sessionId) async {
    try {
      final response = await _dio.get('/commerce/checkout/$sessionId/status');
      return StripeCheckoutStatusResponse.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> cancelCheckout(String sessionId) async {
    try {
      await _dio.post('/commerce/checkout/$sessionId/cancel');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // -------------------------------------------------------------
  // RESERVAS DE PRENDAS
  // -------------------------------------------------------------
  Future<List<Reservation>> listReservations() async {
    try {
      final response = await _dio.get('/commerce/reservations');
      final list = response.data as List<dynamic>;
      return list.map((e) => Reservation.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Reservation> createReservation({
    required int branchId,
    DateTime? appointmentDate,
    String? observation,
    required List<Map<String, dynamic>> items,
  }) async {
    try {
      final response = await _dio.post(
        '/commerce/reservations',
        data: {
          'id_sucursal': branchId,
          if (appointmentDate != null) 'fecha_cita': appointmentDate.toUtc().toIso8601String(),
          if (observation != null && observation.isNotEmpty) 'observacion': observation,
          'items': items,
        },
      );
      return Reservation.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Reservation> cancelReservation(int reservationId) async {
    try {
      final response = await _dio.post('/commerce/reservations/$reservationId/cancel');
      return Reservation.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // -------------------------------------------------------------
  // PEDIDOS Y SEGUIMIENTO DEL CLIENTE
  // -------------------------------------------------------------
  Future<List<Order>> listOrders() async {
    try {
      final response = await _dio.get('/commerce/orders');
      final list = response.data as List<dynamic>;
      return list.map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Order> getOrder(int orderId) async {
    try {
      final response = await _dio.get('/commerce/orders/$orderId');
      return Order.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // -------------------------------------------------------------
  // NOTIFICACIONES OPERATIVAS
  // -------------------------------------------------------------
  Future<List<CustomerNotification>> listNotifications() async {
    try {
      final response = await _dio.get('/commerce/notifications');
      final list = response.data as List<dynamic>;
      return list.map((e) => CustomerNotification.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
