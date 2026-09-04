import 'package:capricho_store/features/catalog/domain/catalog_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Product mapea el contrato de FastAPI', () {
    final product = Product.fromJson({
      'id_producto': 7,
      'nombre': 'Polera esencial',
      'categoria': 'POLERA',
      'marca': 'Capricho',
      'publico_objetivo': 'MUJER',
      'descripcion': 'Algodón',
      'permite_vestidor': true,
      'activo': true,
      'precio_actual': '120.50',
      'imagen_principal': null,
      'variantes': <dynamic>[],
      'tallas_disponibles': ['S', 'M'],
      'colores_disponibles': ['Negro'],
    });

    expect(product.id, 7);
    expect(product.price, 120.50);
    expect(product.category, 'POLERA');
    expect(product.sizes, ['S', 'M']);
  });

  test('CatalogQuery conserva nombres de parámetros del backend', () {
    const query = CatalogQuery(
      category: 'BLUSA',
      audience: 'MUJER',
      sort: '-precio',
      page: 2,
    );
    expect(query.toQuery(), containsPair('categoria', 'BLUSA'));
    expect(query.toQuery(), containsPair('publico_objetivo', 'MUJER'));
    expect(query.toQuery(), containsPair('sort', '-precio'));
    expect(query.toQuery(), containsPair('page', 2));
  });
}
