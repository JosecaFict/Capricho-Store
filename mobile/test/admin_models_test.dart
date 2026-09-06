import 'package:capricho_store/features/admin/domain/admin_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('BranchItem', () {
    test('mapea correctamente el JSON de sucursal', () {
      final json = {
        'id_sucursal': 1,
        'nombre': 'Sucursal Central',
        'direccion': 'Av. Principal 123',
      };

      final item = BranchItem.fromJson(json);
      expect(item.id, 1);
      expect(item.name, 'Sucursal Central');
      expect(item.address, 'Av. Principal 123');
    });

    test('soporta valores por defecto si faltan campos opcionales', () {
      final json = {'id_sucursal': 4};
      final item = BranchItem.fromJson(json);
      expect(item.id, 4);
      expect(item.name, 'Sucursal #4');
      expect(item.address, '');
    });
  });

  group('InventoryStockItem', () {
    test('mapea correctamente datos de inventario y calcula estado de stock bajo', () {
      final json = {
        'id_inventario': 10,
        'id_sucursal': 1,
        'sucursal': 'Sucursal Central',
        'id_variante': 22,
        'sku': 'VEST-ROJ-M',
        'producto': 'Vestido Floral',
        'talla': 'M',
        'color': 'Rojo',
        'categoria': 'VESTIDO',
        'stock_fisico': 3,
        'stock_reservado': 1,
        'stock_minimo': 5,
        'stock_disponible': 2,
        'estado_stock': 'STOCK_BAJO',
        'costo_promedio_ponderado': 45.5,
      };

      final item = InventoryStockItem.fromJson(json);
      expect(item.id, 10);
      expect(item.sku, 'VEST-ROJ-M');
      expect(item.productName, 'Vestido Floral');
      expect(item.availableStock, 2);
      expect(item.minStock, 5);
      expect(item.isLowStock, isTrue);
      expect(item.isOutOfStock, isFalse);
      expect(item.weightedCost, 45.5);
    });

    test('detecta producto agotado', () {
      final json = {
        'id_inventario': 11,
        'id_sucursal': 2,
        'sucursal': 'Sucursal Norte',
        'id_variante': 23,
        'sku': 'POL-NEG-S',
        'producto': 'Polo Negro',
        'talla': 'S',
        'color': 'Negro',
        'categoria': 'POLO',
        'stock_fisico': 0,
        'stock_reservado': 0,
        'stock_minimo': 2,
        'stock_disponible': 0,
        'estado_stock': 'AGOTADO',
      };

      final item = InventoryStockItem.fromJson(json);
      expect(item.isOutOfStock, isTrue);
      expect(item.isLowStock, isTrue);
    });
  });

  group('PurchaseOrderItem', () {
    test('mapea orden de compra y detecta estado pendiente', () {
      final json = {
        'id_orden_compra': 101,
        'id_proveedor': 5,
        'id_sucursal': 1,
        'estado': 'PENDIENTE',
        'fecha_orden': '2026-09-01T10:00:00Z',
        'fecha_estimada': '2026-09-10T10:00:00Z',
        'observacion': 'Pedido para temporada primavera',
        'detalles': [
          {'id_variante': 1, 'cantidad': 10},
          {'id_variante': 2, 'cantidad': 15},
        ],
      };

      final item = PurchaseOrderItem.fromJson(json);
      expect(item.id, 101);
      expect(item.detailsCount, 2);
      expect(item.isPending, isTrue);
      expect(item.notes, 'Pedido para temporada primavera');
    });
  });

  group('TransferItem', () {
    test('mapea transferencia de stock y detecta estado pendiente', () {
      final json = {
        'id_transferencia': 50,
        'id_sucursal_origen': 1,
        'id_sucursal_destino': 2,
        'estado': 'ENVIADA',
        'fecha_solicitud': '2026-09-05T08:00:00Z',
        'detalles': [
          {'id_variante': 10, 'cantidad': 5},
        ],
      };

      final item = TransferItem.fromJson(json);
      expect(item.id, 50);
      expect(item.originBranchId, 1);
      expect(item.destinationBranchId, 2);
      expect(item.status, 'ENVIADA');
      expect(item.isPending, isTrue);
      expect(item.detailsCount, 1);
    });
  });
}
