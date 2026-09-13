import 'package:capricho_store/features/admin/data/admin_repository.dart';
import 'package:capricho_store/features/admin/domain/admin_models.dart';
import 'package:capricho_store/features/admin/domain/operational_access.dart';
import 'package:capricho_store/features/auth/presentation/auth_controller.dart';
import 'package:capricho_store/features/commerce/domain/commerce_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final adminDashboardProvider =
    FutureProvider.autoDispose<AdminDashboardMetrics>((ref) async {
      final user = ref.watch(authControllerProvider).user;
      if (user == null) throw StateError('No hay una sesión activa.');
      return ref
          .watch(adminRepositoryProvider)
          .getDashboardMetrics(
            includeInventory: user.canViewInventory,
            includePurchaseOrders: user.canViewPurchaseOrders,
            includeTransfers: user.canViewTransfers,
            includeReceipts: user.canViewReceipts,
          );
    });

final adminBranchesProvider = FutureProvider.autoDispose<List<BranchItem>>((
  ref,
) async {
  return ref.watch(adminRepositoryProvider).branches();
});

final adminLowStockProvider = FutureProvider.autoDispose
    .family<List<InventoryStockItem>, int?>((ref, branchId) async {
      return ref
          .watch(adminRepositoryProvider)
          .inventory(branchId: branchId, lowStock: true);
    });

final adminBranchInventoryProvider = FutureProvider.autoDispose
    .family<List<InventoryStockItem>, int?>((ref, branchId) async {
      return ref.watch(adminRepositoryProvider).inventory(branchId: branchId);
    });

final adminPurchaseOrdersProvider =
    FutureProvider.autoDispose<List<PurchaseOrderItem>>((ref) async {
      return ref.watch(adminRepositoryProvider).purchaseOrders();
    });

final adminReceiptsProvider = FutureProvider.autoDispose<List<ReceiptItem>>((
  ref,
) async {
  return ref.watch(adminRepositoryProvider).receipts();
});

final adminTransfersProvider = FutureProvider.autoDispose<List<TransferItem>>((
  ref,
) async {
  return ref.watch(adminRepositoryProvider).transfers();
});

class AdminOrderFilter {
  final String? estado;
  final int? sucursal;

  const AdminOrderFilter({this.estado, this.sucursal});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminOrderFilter &&
          runtimeType == other.runtimeType &&
          estado == other.estado &&
          sucursal == other.sucursal;

  @override
  int get hashCode => Object.hash(estado, sucursal);
}

final adminOrdersProvider = FutureProvider.autoDispose
    .family<List<Order>, AdminOrderFilter>((ref, filter) async {
      return ref.watch(adminRepositoryProvider).adminOrders(
            estado: filter.estado,
            sucursal: filter.sucursal,
          );
    });

class AdminOperationsNotifier extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  Future<bool> updateTransferStatus(int transferId, String newStatus) async {
    state = const AsyncValue.loading();
    try {
      await ref
          .read(adminRepositoryProvider)
          .updateTransferStatus(transferId, newStatus);
      ref.invalidate(adminTransfersProvider);
      ref.invalidate(adminDashboardProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> updateOrderStatus(int orderId, String newStatus) async {
    state = const AsyncValue.loading();
    try {
      await ref
          .read(adminRepositoryProvider)
          .updateOrderStatus(orderId, newStatus);
      ref.invalidate(adminOrdersProvider);
      ref.invalidate(adminDashboardProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final adminOperationsNotifierProvider =
    NotifierProvider<AdminOperationsNotifier, AsyncValue<void>>(
      AdminOperationsNotifier.new,
    );
