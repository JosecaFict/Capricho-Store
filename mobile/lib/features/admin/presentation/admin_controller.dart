import 'package:capricho_store/features/admin/data/admin_repository.dart';
import 'package:capricho_store/features/admin/domain/admin_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final adminDashboardProvider =
    FutureProvider.autoDispose<AdminDashboardMetrics>((ref) async {
  return ref.watch(adminRepositoryProvider).getDashboardMetrics();
});

final adminBranchesProvider =
    FutureProvider.autoDispose<List<BranchItem>>((ref) async {
  return ref.watch(adminRepositoryProvider).branches();
});

final adminLowStockProvider =
    FutureProvider.autoDispose.family<List<InventoryStockItem>, int?>(
  (ref, branchId) async {
    return ref
        .watch(adminRepositoryProvider)
        .inventory(branchId: branchId, lowStock: true);
  },
);

final adminBranchInventoryProvider =
    FutureProvider.autoDispose.family<List<InventoryStockItem>, int?>(
  (ref, branchId) async {
    return ref
        .watch(adminRepositoryProvider)
        .inventory(branchId: branchId);
  },
);

final adminPurchaseOrdersProvider =
    FutureProvider.autoDispose<List<PurchaseOrderItem>>((ref) async {
  return ref.watch(adminRepositoryProvider).purchaseOrders();
});

final adminReceiptsProvider =
    FutureProvider.autoDispose<List<ReceiptItem>>((ref) async {
  return ref.watch(adminRepositoryProvider).receipts();
});

final adminTransfersProvider =
    FutureProvider.autoDispose<List<TransferItem>>((ref) async {
  return ref.watch(adminRepositoryProvider).transfers();
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
}

final adminOperationsNotifierProvider =
    NotifierProvider<AdminOperationsNotifier, AsyncValue<void>>(
  AdminOperationsNotifier.new,
);
