import 'package:capricho_store/features/auth/domain/app_user.dart';

enum OperationalSection { summary, inventory, operations, account }

abstract final class OperationalPermissions {
  static const inventoryView = 'inventario.ver';
  static const inventoryMovement = 'inventario.movimiento';
  static const receiptRegister = 'recepcion.registrar';
  static const suppliersView = 'proveedores.ver';
  static const suppliersManage = 'proveedores.gestionar';
  static const productsView = 'productos.ver';

  static const mobileCapabilities = {
    inventoryView,
    inventoryMovement,
    receiptRegister,
    suppliersView,
    suppliersManage,
    productsView,
  };
}

extension OperationalAccess on AppUser {
  bool get isActive => status.trim().toUpperCase() == 'ACTIVO';

  bool get hasOperationalRole => roles.any(
    const {
      'ADMIN',
      'ADMINISTRADOR',
      'ENCARGADO_SUCURSAL',
      'AUXILIAR_INVENTARIO',
      'CAJERO',
    }.contains,
  );

  bool get canAccessOperationalPanel =>
      isActive &&
      hasOperationalRole &&
      (isAdmin ||
          permissions.any(OperationalPermissions.mobileCapabilities.contains));

  bool get canViewInventory =>
      hasPermission(OperationalPermissions.inventoryView);

  bool get canManageInventory =>
      hasPermission(OperationalPermissions.inventoryMovement);

  bool get canViewPurchaseOrders =>
      hasPermission(OperationalPermissions.suppliersView);

  bool get canViewReceipts =>
      hasPermission(OperationalPermissions.receiptRegister);

  bool get canViewTransfers => canViewInventory;

  bool get canViewOperations =>
      canViewPurchaseOrders || canViewReceipts || canViewTransfers;

  bool canAccessSection(OperationalSection section) => switch (section) {
    OperationalSection.summary => canAccessOperationalPanel,
    OperationalSection.inventory => canViewInventory,
    OperationalSection.operations => canViewOperations,
    OperationalSection.account => canAccessOperationalPanel,
  };

  String get operationalContextLabel {
    if (roles.contains('ENCARGADO_SUCURSAL')) return 'Operaciones de sucursal';
    if (roles.contains('AUXILIAR_INVENTARIO')) return 'Inventario';
    if (roles.contains('CAJERO')) return 'Operaciones';
    return 'Panel operativo';
  }
}
