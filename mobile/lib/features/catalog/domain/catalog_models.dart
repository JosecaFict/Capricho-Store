class ProductImage {
  const ProductImage(this.url);
  factory ProductImage.fromJson(Map<String, dynamic> json) =>
      ProductImage(json['secure_url'] as String);
  final String url;
}

class ProductVariant {
  const ProductVariant({
    required this.id,
    required this.size,
    required this.color,
    required this.active,
    this.hex,
    this.stock,
    this.stockStatus,
  });
  factory ProductVariant.fromJson(Map<String, dynamic> json) => ProductVariant(
    id: json['id_variante'] as int,
    size: json['talla'] as String,
    color: json['color'] as String,
    hex: json['codigo_hex'] as String?,
    active: json['activo'] as bool,
    stock: json['stock_disponible'] as int?,
    stockStatus: json['estado_stock'] as String?,
  );
  final int id;
  final String size;
  final String color;
  final String? hex;
  final bool active;
  final int? stock;
  final String? stockStatus;
}

class Product {
  const Product({
    required this.id,
    required this.name,
    required this.category,
    required this.brand,
    required this.audience,
    required this.fittingEnabled,
    required this.active,
    required this.variants,
    required this.sizes,
    required this.colors,
    this.description,
    this.price,
    this.image,
  });
  factory Product.fromJson(Map<String, dynamic> json) => Product(
    id: json['id_producto'] as int,
    name: json['nombre'] as String,
    category: json['categoria'] as String,
    brand: json['marca'] as String,
    audience: json['publico_objetivo'] as String,
    description: json['descripcion'] as String?,
    fittingEnabled: json['permite_vestidor'] as bool,
    active: json['activo'] as bool,
    price: double.tryParse(json['precio_actual']?.toString() ?? ''),
    image: json['imagen_principal'] is Map<String, dynamic>
        ? ProductImage.fromJson(
            json['imagen_principal'] as Map<String, dynamic>,
          )
        : null,
    variants: (json['variantes'] as List? ?? const [])
        .map((item) => ProductVariant.fromJson(item as Map<String, dynamic>))
        .toList(),
    sizes: List<String>.from(json['tallas_disponibles'] as List? ?? const []),
    colors: List<String>.from(json['colores_disponibles'] as List? ?? const []),
  );
  final int id;
  final String name;
  final String category;
  final String brand;
  final String audience;
  final String? description;
  final bool fittingEnabled;
  final bool active;
  final double? price;
  final ProductImage? image;
  final List<ProductVariant> variants;
  final List<String> sizes;
  final List<String> colors;
}

class ProductPage {
  const ProductPage({
    required this.items,
    required this.page,
    required this.total,
    required this.pages,
  });
  factory ProductPage.fromJson(Map<String, dynamic> json) => ProductPage(
    items: (json['items'] as List)
        .map((item) => Product.fromJson(item as Map<String, dynamic>))
        .toList(),
    page: json['page'] as int,
    total: json['total'] as int,
    pages: json['pages'] as int,
  );
  final List<Product> items;
  final int page;
  final int total;
  final int pages;
}

class CatalogQuery {
  const CatalogQuery({
    this.category,
    this.audience,
    this.sort = 'nombre',
    this.page = 1,
  });
  final String? category;
  final String? audience;
  final String sort;
  final int page;

  Map<String, dynamic> toQuery() => {
    'page': page,
    'page_size': 20,
    'sort': sort,
    if (category != null) 'categoria': category,
    if (audience != null) 'publico_objetivo': audience,
  };
}
