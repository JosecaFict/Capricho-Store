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
    this.sku,
    this.barcode,
    this.hex,
    this.stock,
    this.stockStatus,
  });
  factory ProductVariant.fromJson(Map<String, dynamic> json) => ProductVariant(
    id: json['id_variante'] as int,
    size: json['talla'] as String,
    color: json['color'] as String,
    hex: json['codigo_hex'] as String?,
    sku: json['sku'] as String?,
    barcode: json['codigo_barras'] as String?,
    active: json['activo'] as bool,
    stock: json['stock_disponible'] as int?,
    stockStatus: json['estado_stock'] as String?,
  );
  final int id;
  final String size;
  final String color;
  final String? hex;
  final String? sku;
  final String? barcode;
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

class CategoryItem {
  const CategoryItem({
    required this.id,
    required this.name,
    this.description,
    this.active = true,
  });

  factory CategoryItem.fromJson(Map<String, dynamic> json) => CategoryItem(
    id: json['id_categoria'] as int,
    name: json['nombre'] as String,
    description: json['descripcion'] as String?,
    active: json['activo'] as bool? ?? true,
  );

  final int id;
  final String name;
  final String? description;
  final bool active;
}

class BrandItem {
  const BrandItem({required this.id, required this.name, this.active = true});

  factory BrandItem.fromJson(Map<String, dynamic> json) => BrandItem(
    id: json['id_marca'] as int,
    name: json['nombre'] as String,
    active: json['activo'] as bool? ?? true,
  );

  final int id;
  final String name;
  final bool active;
}

class SizeItem {
  const SizeItem({required this.id, required this.name, this.order});

  factory SizeItem.fromJson(Map<String, dynamic> json) => SizeItem(
    id: json['id_talla'] as int,
    name: json['codigo'] as String,
    order: json['orden'] as int?,
  );

  final int id;
  final String name;
  final int? order;
}

class ColorItem {
  const ColorItem({required this.id, required this.name, this.hex});

  factory ColorItem.fromJson(Map<String, dynamic> json) => ColorItem(
    id: json['id_color'] as int,
    name: json['nombre'] as String,
    hex: json['codigo_hex'] as String?,
  );

  final int id;
  final String name;
  final String? hex;
}

class SeasonItem {
  const SeasonItem({required this.id, required this.name, this.year});

  factory SeasonItem.fromJson(Map<String, dynamic> json) => SeasonItem(
    id: json['id_temporada'] as int,
    name: json['nombre'] as String,
    year: json['anio'] as int?,
  );

  final int id;
  final String name;
  final int? year;
}

class ProductMeasurement {
  const ProductMeasurement({
    required this.id,
    required this.size,
    this.shouldersCm,
    this.chestCm,
    this.lengthCm,
    this.sleeveCm,
  });

  factory ProductMeasurement.fromJson(Map<String, dynamic> json) =>
      ProductMeasurement(
        id: json['id_medida'] as int,
        size: json['talla'] as String,
        shouldersCm: double.tryParse(
          json['ancho_hombros_cm']?.toString() ?? '',
        ),
        chestCm: double.tryParse(json['ancho_pecho_cm']?.toString() ?? ''),
        lengthCm: double.tryParse(json['largo_prenda_cm']?.toString() ?? ''),
        sleeveCm: double.tryParse(json['largo_manga_cm']?.toString() ?? ''),
      );

  final int id;
  final String size;
  final double? shouldersCm;
  final double? chestCm;
  final double? lengthCm;
  final double? sleeveCm;
}

class BranchItem {
  const BranchItem({
    required this.id,
    required this.name,
    required this.address,
  });

  factory BranchItem.fromJson(Map<String, dynamic> json) => BranchItem(
    id: json['id_sucursal'] as int,
    name: json['nombre'] as String,
    address: json['direccion'] as String? ?? '',
  );

  final int id;
  final String name;
  final String address;
}

class CatalogQuery {
  const CatalogQuery({
    this.category,
    this.audience,
    this.brand,
    this.size,
    this.color,
    this.season,
    this.branchId,
    this.fittingEnabled,
    this.sort = 'nombre',
    this.page = 1,
    this.pageSize = 20,
  });

  final String? category;
  final String? audience;
  final String? brand;
  final String? size;
  final String? color;
  final String? season;
  final int? branchId;
  final bool? fittingEnabled;
  final String sort;
  final int page;
  final int pageSize;

  bool get hasActiveFilters =>
      (category != null && category!.isNotEmpty) ||
      (audience != null && audience!.isNotEmpty) ||
      (brand != null && brand!.isNotEmpty) ||
      (size != null && size!.isNotEmpty) ||
      (color != null && color!.isNotEmpty) ||
      (season != null && season!.isNotEmpty) ||
      branchId != null ||
      fittingEnabled != null;

  Map<String, dynamic> toQuery() => {
    'page': page,
    'page_size': pageSize,
    'sort': sort,
    if (category != null && category!.isNotEmpty) 'categoria': category,
    if (audience != null && audience!.isNotEmpty) 'publico_objetivo': audience,
    if (brand != null && brand!.isNotEmpty) 'marca': brand,
    if (size != null && size!.isNotEmpty) 'talla': size,
    if (color != null && color!.isNotEmpty) 'color': color,
    if (season != null && season!.isNotEmpty) 'temporada': season,
    if (branchId != null) 'sucursal': branchId,
    if (fittingEnabled != null) 'permite_vestidor': fittingEnabled,
  };

  CatalogQuery copyWith({
    String? category,
    String? audience,
    String? brand,
    String? size,
    String? color,
    String? season,
    int? branchId,
    bool? fittingEnabled,
    String? sort,
    int? page,
    int? pageSize,
    bool clearCategory = false,
    bool clearAudience = false,
    bool clearBrand = false,
    bool clearSize = false,
    bool clearColor = false,
    bool clearSeason = false,
    bool clearBranch = false,
    bool clearFittingEnabled = false,
  }) {
    return CatalogQuery(
      category: clearCategory ? null : (category ?? this.category),
      audience: clearAudience ? null : (audience ?? this.audience),
      brand: clearBrand ? null : (brand ?? this.brand),
      size: clearSize ? null : (size ?? this.size),
      color: clearColor ? null : (color ?? this.color),
      season: clearSeason ? null : (season ?? this.season),
      branchId: clearBranch ? null : (branchId ?? this.branchId),
      fittingEnabled:
          clearFittingEnabled ? null : (fittingEnabled ?? this.fittingEnabled),
      sort: sort ?? this.sort,
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
    );
  }
}
