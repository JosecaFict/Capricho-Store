import 'package:capricho_store/core/network/api_client.dart';
import 'package:capricho_store/core/network/api_exception.dart';
import 'package:capricho_store/features/admin/domain/admin_models.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final adminRepositoryProvider = Provider<AdminRepository>((ref) {
  return AdminRepository(ref.watch(dioProvider));
});

class AdminRepository {
  const AdminRepository(this._dio);
  final Dio _dio;

  Future<List<BranchItem>> branches() async {
    try {
      final res = await _dio.get('/branches');
      final list = (res.data as List? ?? []);
      return list
          .map((e) => BranchItem.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<InventoryStockItem>> inventory({
    int? branchId,
    bool? lowStock,
    bool? outOfStock,
  }) async {
    try {
      final params = <String, dynamic>{};
      if (branchId != null) params['sucursal'] = branchId;
      if (lowStock != null) params['stock_bajo'] = lowStock;
      if (outOfStock != null) params['agotado'] = outOfStock;

      final res = await _dio.get('/inventory', queryParameters: params);
      final list = (res.data as List? ?? []);
      return list
          .map((e) => InventoryStockItem.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<PurchaseOrderItem>> purchaseOrders() async {
    try {
      final res = await _dio.get('/purchase-orders');
      final list = (res.data as List? ?? []);
      return list
          .map((e) => PurchaseOrderItem.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<ReceiptItem>> receipts() async {
    try {
      final res = await _dio.get('/receipts');
      final list = (res.data as List? ?? []);
      return list
          .map((e) => ReceiptItem.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<TransferItem>> transfers() async {
    try {
      final res = await _dio.get('/inventory/transfers');
      final list = (res.data as List? ?? []);
      return list
          .map((e) => TransferItem.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<TransferItem> updateTransferStatus(int transferId, String status) async {
    try {
      final res = await _dio.patch(
        '/inventory/transfers/$transferId/status',
        data: {'estado': status},
      );
      return TransferItem.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<AdminDashboardMetrics> getDashboardMetrics() async {
    try {
      final results = await Future.wait([
        inventory(lowStock: true).catchError((_) => <InventoryStockItem>[]),
        purchaseOrders().catchError((_) => <PurchaseOrderItem>[]),
        transfers().catchError((_) => <TransferItem>[]),
        receipts().catchError((_) => <ReceiptItem>[]),
      ]);

      final lowStockList = results[0] as List<InventoryStockItem>;
      final ordersList = results[1] as List<PurchaseOrderItem>;
      final transfersList = results[2] as List<TransferItem>;
      final receiptsList = results[3] as List<ReceiptItem>;

      final pendingOrders = ordersList.where((o) => o.isPending).toList();
      final pendingTransfers = transfersList.where((t) => t.isPending).toList();

      final alerts = <AdminAlert>[];

      // Alertas por stock crítico
      for (final item in lowStockList.take(5)) {
        alerts.add(
          AdminAlert(
            id: 'stock_${item.id}',
            title: 'Stock bajo: ${item.productName}',
            message:
                'Quedan solo ${item.availableStock} unid. (Mínimo: ${item.minStock}) en ${item.branchName}.',
            level: item.isOutOfStock ? AdminAlertLevel.critical : AdminAlertLevel.warning,
            category: 'INVENTARIO',
            referenceId: item.id,
          ),
        );
      }

      // Alertas por transferencias pendientes
      for (final t in pendingTransfers.take(3)) {
        alerts.add(
          AdminAlert(
            id: 'transfer_${t.id}',
            title: 'Transferencia #${t.id} en estado ${t.status}',
            message:
                'Despacho desde sucursal #${t.originBranchId} hacia #${t.destinationBranchId} con ${t.detailsCount} prendas.',
            level: AdminAlertLevel.info,
            category: 'TRANSFERENCIAS',
            referenceId: t.id,
          ),
        );
      }

      // Alertas por órdenes de compra pendientes
      for (final o in pendingOrders.take(3)) {
        alerts.add(
          AdminAlert(
            id: 'order_${o.id}',
            title: 'Orden de compra #${o.id} pendiente',
            message:
                'Esperando recepción en sucursal #${o.branchId}. Estado actual: ${o.status}.',
            level: AdminAlertLevel.warning,
            category: 'COMPRAS',
            referenceId: o.id,
          ),
        );
      }

      return AdminDashboardMetrics(
        criticalStockCount: lowStockList.length,
        pendingOrdersCount: pendingOrders.length,
        pendingTransfersCount: pendingTransfers.length,
        recentReceiptsCount: receiptsList.length,
        alerts: alerts,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
