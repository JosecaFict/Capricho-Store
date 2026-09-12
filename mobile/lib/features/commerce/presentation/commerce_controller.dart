import 'package:capricho_store/core/network/api_exception.dart';
import 'package:capricho_store/features/commerce/data/commerce_api.dart';
import 'package:capricho_store/features/commerce/domain/commerce_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// -------------------------------------------------------------
// CARRITO CONTROLLER
// -------------------------------------------------------------
final cartProvider = AsyncNotifierProvider<CartController, Cart?>(CartController.new);

class CartController extends AsyncNotifier<Cart?> {
  CommerceApi get _api => ref.read(commerceApiProvider);

  @override
  Future<Cart?> build() async {
    try {
      return await _api.getCart();
    } on ApiException catch (e) {
      if (e.statusCode == 401 || e.statusCode == 404) {
        return null;
      }
      rethrow;
    } catch (_) {
      return null;
    }
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      try {
        return await _api.getCart();
      } on ApiException catch (e) {
        if (e.statusCode == 401 || e.statusCode == 404) {
          return null;
        }
        rethrow;
      }
    });
  }

  Future<void> addItem({
    required int variantId,
    required int quantity,
    int? branchId,
  }) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => _api.addCartItem(
        variantId: variantId,
        quantity: quantity,
        branchId: branchId,
      ),
    );
  }

  Future<void> updateQuantity({required int itemId, required int quantity}) async {
    if (quantity <= 0) {
      await removeItem(itemId);
      return;
    }
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => _api.updateCartItem(itemId: itemId, quantity: quantity),
    );
  }

  Future<void> removeItem(int itemId) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _api.removeCartItem(itemId: itemId));
  }

  Future<void> clear() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _api.clearCart());
  }
}

final cartItemCountProvider = Provider<int>((ref) {
  final cart = ref.watch(cartProvider).value;
  return cart?.totalQuantity ?? 0;
});

// -------------------------------------------------------------
// RESERVAS CONTROLLER
// -------------------------------------------------------------
final reservationsProvider =
    AsyncNotifierProvider<ReservationsController, List<Reservation>>(
        ReservationsController.new);

class ReservationsController extends AsyncNotifier<List<Reservation>> {
  CommerceApi get _api => ref.read(commerceApiProvider);

  @override
  Future<List<Reservation>> build() async {
    try {
      return await _api.listReservations();
    } catch (_) {
      return [];
    }
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _api.listReservations());
  }

  Future<Reservation> createReservation({
    required int branchId,
    DateTime? appointmentDate,
    String? observation,
    required int variantId,
    required int quantity,
  }) async {
    final result = await _api.createReservation(
      branchId: branchId,
      appointmentDate: appointmentDate,
      observation: observation,
      items: [
        {'id_variante': variantId, 'cantidad': quantity},
      ],
    );
    await refresh();
    return result;
  }

  Future<void> cancelReservation(int reservationId) async {
    await _api.cancelReservation(reservationId);
    await refresh();
  }
}

// -------------------------------------------------------------
// PEDIDOS CONTROLLER
// -------------------------------------------------------------
final ordersProvider =
    AsyncNotifierProvider<OrdersController, List<Order>>(OrdersController.new);

class OrdersController extends AsyncNotifier<List<Order>> {
  CommerceApi get _api => ref.read(commerceApiProvider);

  @override
  Future<List<Order>> build() async {
    try {
      return await _api.listOrders();
    } catch (_) {
      return [];
    }
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _api.listOrders());
  }
}

// -------------------------------------------------------------
// DIRECCIONES CONTROLLER
// -------------------------------------------------------------
final addressesProvider =
    AsyncNotifierProvider<AddressesController, List<Address>>(
        AddressesController.new);

class AddressesController extends AsyncNotifier<List<Address>> {
  CommerceApi get _api => ref.read(commerceApiProvider);

  @override
  Future<List<Address>> build() async {
    try {
      return await _api.listAddresses();
    } catch (_) {
      return [];
    }
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _api.listAddresses());
  }

  Future<Address> addAddress({
    required int cityId,
    String? alias,
    String? zone,
    required String address,
    String? reference,
    double? latitude,
    double? longitude,
    bool isMain = false,
  }) async {
    final result = await _api.createAddress(
      cityId: cityId,
      alias: alias,
      zone: zone,
      address: address,
      reference: reference,
      latitude: latitude,
      longitude: longitude,
      isMain: isMain,
    );
    await refresh();
    return result;
  }
}

// -------------------------------------------------------------
// NOTIFICACIONES CONTROLLER
// -------------------------------------------------------------
final notificationsProvider =
    AsyncNotifierProvider<NotificationsController, List<CustomerNotification>>(
        NotificationsController.new);

class NotificationsController extends AsyncNotifier<List<CustomerNotification>> {
  CommerceApi get _api => ref.read(commerceApiProvider);

  @override
  Future<List<CustomerNotification>> build() async {
    try {
      return await _api.listNotifications();
    } catch (_) {
      return [];
    }
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _api.listNotifications());
  }
}
