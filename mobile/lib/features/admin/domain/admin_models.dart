class BranchItem {
  const BranchItem({
    required this.id,
    required this.name,
    required this.address,
  });

  factory BranchItem.fromJson(Map<String, dynamic> json) => BranchItem(
        id: json['id_sucursal'] as int,
        name: json['nombre'] as String? ?? 'Sucursal #${json['id_sucursal']}',
        address: json['direccion'] as String? ?? '',
      );

  final int id;
  final String name;
  final String address;
}

class InventoryStockItem {
  const InventoryStockItem({
    required this.id,
    required this.branchId,
    required this.branchName,
    required this.variantId,
    required this.sku,
    required this.productName,
    required this.size,
    required this.color,
    required this.category,
    required this.physicalStock,
    required this.reservedStock,
    required this.minStock,
    required this.availableStock,
    required this.stockStatus,
    this.weightedCost,
  });

  factory InventoryStockItem.fromJson(Map<String, dynamic> json) =>
      InventoryStockItem(
        id: json['id_inventario'] as int,
        branchId: json['id_sucursal'] as int,
        branchName: json['sucursal'] as String? ?? 'Sucursal',
        variantId: json['id_variante'] as int,
        sku: json['sku'] as String? ?? 'SKU-${json['id_variante']}',
        productName: json['producto'] as String? ?? 'Prenda',
        size: json['talla'] as String? ?? '-',
        color: json['color'] as String? ?? '-',
        category: json['categoria'] as String? ?? '',
        physicalStock: (json['stock_fisico'] as num?)?.toInt() ?? 0,
        reservedStock: (json['stock_reservado'] as num?)?.toInt() ?? 0,
        minStock: (json['stock_minimo'] as num?)?.toInt() ?? 0,
        availableStock: (json['stock_disponible'] as num?)?.toInt() ?? 0,
        stockStatus: json['estado_stock'] as String? ?? 'DISPONIBLE',
        weightedCost: (json['costo_promedio_ponderado'] as num?)?.toDouble(),
      );

  final int id;
  final int branchId;
  final String branchName;
  final int variantId;
  final String sku;
  final String productName;
  final String size;
  final String color;
  final String category;
  final int physicalStock;
  final int reservedStock;
  final int minStock;
  final int availableStock;
  final String stockStatus;
  final double? weightedCost;

  bool get isLowStock => stockStatus == 'STOCK_BAJO' || availableStock <= minStock;
  bool get isOutOfStock => stockStatus == 'AGOTADO' || availableStock <= 0;
}

class PurchaseOrderItem {
  const PurchaseOrderItem({
    required this.id,
    required this.supplierId,
    required this.branchId,
    required this.status,
    required this.orderDate,
    this.estimatedDate,
    this.notes,
    required this.detailsCount,
  });

  factory PurchaseOrderItem.fromJson(Map<String, dynamic> json) {
    final detailsList = json['detalles'] as List? ?? const [];
    return PurchaseOrderItem(
      id: json['id_orden_compra'] as int,
      supplierId: json['id_proveedor'] as int,
      branchId: json['id_sucursal'] as int,
      status: json['estado'] as String? ?? 'PENDIENTE',
      orderDate: DateTime.tryParse(json['fecha_orden'] as String? ?? '') ??
          DateTime.now(),
      estimatedDate: json['fecha_estimada'] != null
          ? DateTime.tryParse(json['fecha_estimada'] as String)
          : null,
      notes: json['observacion'] as String?,
      detailsCount: detailsList.length,
    );
  }

  final int id;
  final int supplierId;
  final int branchId;
  final String status;
  final DateTime orderDate;
  final DateTime? estimatedDate;
  final String? notes;
  final int detailsCount;

  bool get isPending => status == 'PENDIENTE' || status == 'APROBADA' || status == 'EN_TRANSITO';
}

class ReceiptItem {
  const ReceiptItem({
    required this.id,
    this.purchaseOrderId,
    required this.branchId,
    required this.receiptDate,
    required this.status,
    this.notes,
    required this.detailsCount,
  });

  factory ReceiptItem.fromJson(Map<String, dynamic> json) {
    final detailsList = json['detalles'] as List? ?? const [];
    return ReceiptItem(
      id: json['id_recepcion'] as int,
      purchaseOrderId: json['id_orden_compra'] as int?,
      branchId: json['id_sucursal'] as int,
      receiptDate: DateTime.tryParse(json['fecha_recepcion'] as String? ?? '') ??
          DateTime.now(),
      status: json['estado'] as String? ?? 'RECIBIDA',
      notes: json['observacion'] as String?,
      detailsCount: detailsList.length,
    );
  }

  final int id;
  final int? purchaseOrderId;
  final int branchId;
  final DateTime receiptDate;
  final String status;
  final String? notes;
  final int detailsCount;
}

class TransferItem {
  const TransferItem({
    required this.id,
    required this.originBranchId,
    required this.destinationBranchId,
    required this.status,
    required this.requestDate,
    this.receivedDate,
    required this.detailsCount,
  });

  factory TransferItem.fromJson(Map<String, dynamic> json) {
    final detailsList = json['detalles'] as List? ?? const [];
    return TransferItem(
      id: json['id_transferencia'] as int,
      originBranchId: json['id_sucursal_origen'] as int,
      destinationBranchId: json['id_sucursal_destino'] as int,
      status: json['estado'] as String? ?? 'SOLICITADA',
      requestDate: DateTime.tryParse(json['fecha_solicitud'] as String? ?? '') ??
          DateTime.now(),
      receivedDate: json['fecha_recepcion'] != null
          ? DateTime.tryParse(json['fecha_recepcion'] as String)
          : null,
      detailsCount: detailsList.length,
    );
  }

  final int id;
  final int originBranchId;
  final int destinationBranchId;
  final String status;
  final DateTime requestDate;
  final DateTime? receivedDate;
  final int detailsCount;

  bool get isPending => status == 'SOLICITADA' || status == 'APROBADA' || status == 'ENVIADA';
}

class AdminDashboardMetrics {
  const AdminDashboardMetrics({
    required this.criticalStockCount,
    required this.pendingOrdersCount,
    required this.pendingTransfersCount,
    required this.recentReceiptsCount,
    required this.alerts,
  });

  final int criticalStockCount;
  final int pendingOrdersCount;
  final int pendingTransfersCount;
  final int recentReceiptsCount;
  final List<AdminAlert> alerts;
}

class AdminAlert {
  const AdminAlert({
    required this.id,
    required this.title,
    required this.message,
    required this.level,
    required this.category,
    this.referenceId,
  });

  final String id;
  final String title;
  final String message;
  final AdminAlertLevel level;
  final String category;
  final int? referenceId;
}

enum AdminAlertLevel {
  critical,
  warning,
  info,
}
