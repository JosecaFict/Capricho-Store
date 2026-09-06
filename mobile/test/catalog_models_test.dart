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

  test(
    'CatalogQuery maneja filtros extendidos (marca, talla, color, temporada)',
    () {
      const query = CatalogQuery(
        category: 'POLO',
        audience: 'HOMBRE',
        brand: 'Capricho Premium',
        size: 'L',
        color: 'Azul',
        season: 'Verano 2026',
        sort: '-created_at',
        page: 1,
      );

      final params = query.toQuery();
      expect(params['marca'], 'Capricho Premium');
      expect(params['talla'], 'L');
      expect(params['color'], 'Azul');
      expect(params['temporada'], 'Verano 2026');
      expect(query.hasActiveFilters, isTrue);

      final cleared = query.copyWith(clearBrand: true, clearColor: true);
      expect(cleared.brand, isNull);
      expect(cleared.color, isNull);
      expect(cleared.size, 'L');
    },
  );

  test('CategoryItem, BrandItem, ColorItem y ProductMeasurement parsean correctamente', () {
    final cat = CategoryItem.fromJson({
      'id_categoria': 1,
      'nombre': 'CAMISA',
      'descripcion': 'Manga larga',
      'activo': true,
    });
    expect(cat.id, 1);
    expect(cat.name, 'CAMISA');

    final color = ColorItem.fromJson({
      'id_color': 3,
      'nombre': 'Rojo',
      'codigo_hex': '#FF0000',
    });
    expect(color.hex, '#FF0000');

    final measurement = ProductMeasurement.fromJson({
      'id_medida': 10,
      'talla': 'M',
      'ancho_hombros_cm': '44.5',
      'ancho_pecho_cm': '52.0',
      'largo_prenda_cm': '70.0',
      'largo_manga_cm': '22.0',
    });
    expect(measurement.shouldersCm, 44.5);
    expect(measurement.chestCm, 52.0);
    expect(measurement.size, 'M');
  });
}
