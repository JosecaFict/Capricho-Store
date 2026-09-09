import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/catalog/data/catalog_repository.dart';
import 'package:capricho_store/features/catalog/domain/catalog_models.dart';
import 'package:capricho_store/shared/widgets/adaptive/adaptive_image.dart';
import 'package:capricho_store/shared/widgets/message_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({required this.productId, super.key});
  final int productId;

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  late Future<_ProductDetailData> _future;
  final PageController _imagePageController = PageController();

  int _selectedImageIndex = 0;
  String? _selectedSize;
  String? _selectedColor;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _imagePageController.dispose();
    super.dispose();
  }

  void _loadData() {
    final repo = ref.read(catalogRepositoryProvider);
    _future =
        Future.wait([
          repo.product(widget.productId),
          repo
              .productImages(widget.productId)
              .catchError((_) => <ProductImage>[]),
          repo
              .productVariants(widget.productId)
              .catchError((_) => <ProductVariant>[]),
          repo
              .productMeasurements(widget.productId)
              .catchError((_) => <ProductMeasurement>[]),
        ]).then((results) {
          final product = results[0] as Product;
          final images = results[1] as List<ProductImage>;
          final variants = results[2] as List<ProductVariant>;
          final measurements = results[3] as List<ProductMeasurement>;

          // Si no devolvió imágenes específicas, usamos la principal del producto
          final effectiveImages = images.isNotEmpty
              ? images
              : (product.image != null ? [product.image!] : <ProductImage>[]);

          // Si el endpoint de variantes dio vacío, usar las que vienen anidadas en product
          final effectiveVariants = variants.isNotEmpty
              ? variants
              : product.variants;

          return _ProductDetailData(
            product: product,
            images: effectiveImages,
            variants: effectiveVariants,
            measurements: measurements,
          );
        });
  }

  Future<void> _refresh() async {
    setState(() {
      _loadData();
    });
    await _future;
  }

  ProductVariant? _findMatchingVariant(List<ProductVariant> variants) {
    if (_selectedSize == null && _selectedColor == null) return null;
    try {
      return variants.firstWhere((v) {
        final matchesSize = _selectedSize == null || v.size == _selectedSize;
        final matchesColor =
            _selectedColor == null || v.color == _selectedColor;
        return matchesSize && matchesColor;
      });
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.currency(locale: 'es_BO', symbol: 'Bs.');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Detalle de prenda'),
        shape: const Border(
          bottom: BorderSide(color: AppColors.line, width: 1),
        ),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _refresh,
          ),
        ],
      ),
      body: FutureBuilder<_ProductDetailData>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return MessageState(
              title: 'No pudimos cargar la prenda',
              message: snapshot.error.toString(),
              onRetry: _refresh,
            );
          }

          final data = snapshot.data!;
          final product = data.product;
          final images = data.images;
          final variants = data.variants;
          final measurements = data.measurements;

          final matchedVariant = _findMatchingVariant(variants);

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.only(bottom: 40),
              children: [
                _buildImageGallery(images),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Marca y Público
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            product.brand.toUpperCase(),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.2,
                              color: AppColors.cobalt,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.muted,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: AppColors.line),
                            ),
                            child: Text(
                              '${product.category} · ${product.audience}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppColors.inkSoft,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),

                      // Nombre del producto
                      Text(
                        product.name,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.ink,
                          letterSpacing: -0.4,
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Precio
                      Text(
                        product.price != null
                            ? currency.format(product.price)
                            : 'Precio por definir',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                          color: product.price != null
                              ? AppColors.cobaltDark
                              : AppColors.inkSoft,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Descripción
                      if (product.description != null &&
                          product.description!.trim().isNotEmpty) ...[
                        Text(
                          product.description!,
                          style: TextStyle(
                            color: Colors.grey.shade800,
                            fontSize: 14,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],

                      const Divider(),
                      const SizedBox(height: 16),

                      // Selector de Talla
                      if (product.sizes.isNotEmpty) ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Talla',
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.bold),
                            ),
                            if (_selectedSize != null)
                              TextButton(
                                onPressed: () {
                                  HapticFeedback.selectionClick();
                                  setState(() => _selectedSize = null);
                                },
                                style: TextButton.styleFrom(
                                  visualDensity: VisualDensity.compact,
                                ),
                                child: const Text('Quitar selección'),
                              ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: product.sizes.map((s) {
                            final isSelected = _selectedSize == s;
                            return ChoiceChip(
                              label: Text(s),
                              selected: isSelected,
                              onSelected: (val) {
                                HapticFeedback.selectionClick();
                                setState(() {
                                  _selectedSize = val ? s : null;
                                });
                              },
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 20),
                      ],

                      // Selector de Color
                      if (product.colors.isNotEmpty) ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Color',
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.bold),
                            ),
                            if (_selectedColor != null)
                              TextButton(
                                onPressed: () {
                                  HapticFeedback.selectionClick();
                                  setState(() => _selectedColor = null);
                                },
                                style: TextButton.styleFrom(
                                  visualDensity: VisualDensity.compact,
                                ),
                                child: const Text('Quitar selección'),
                              ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: product.colors.map((c) {
                            final isSelected = _selectedColor == c;
                            // Buscar hex si existe en las variantes
                            String? hex;
                            try {
                              hex = variants
                                  .firstWhere(
                                    (v) => v.color == c && v.hex != null,
                                  )
                                  .hex;
                            } catch (_) {}

                            Color? dotColor;
                            if (hex != null) {
                              final hexClean = hex.replaceAll('#', '');
                              if (hexClean.length == 6) {
                                dotColor = Color(int.parse('0xFF$hexClean'));
                              }
                            }

                            return ChoiceChip(
                              avatar: dotColor != null
                                  ? CircleAvatar(
                                      backgroundColor: dotColor,
                                      radius: 6,
                                    )
                                  : null,
                              label: Text(c),
                              selected: isSelected,
                              onSelected: (val) {
                                HapticFeedback.selectionClick();
                                setState(() {
                                  _selectedColor = val ? c : null;
                                });
                              },
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 20),
                      ],

                      // Banner de compatibilidad con vestidor virtual (AR)
                      if (product.fittingEnabled) ...[
                        _buildFittingBanner(context),
                        const SizedBox(height: 16),
                      ],

                      // Disponibilidad Real en Stock
                      _buildStockAvailabilityCard(matchedVariant),
                      const SizedBox(height: 24),

                      // Tabla de medidas de la prenda
                      _buildMeasurementsSection(measurements),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildFittingBanner(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), AppColors.cobalt],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: AppColors.cobalt.withValues(alpha: 0.25),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.auto_awesome,
              color: Colors.white,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Compatible con Vestidor Virtual',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                    letterSpacing: 0.2,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Esta prenda cuenta con soporte para prueba con realidad aumentada.',
                  style: TextStyle(
                    color: Color(0xFFE2E8F0),
                    fontSize: 11.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildImageGallery(List<ProductImage> images) {
    if (images.isEmpty) {
      return const AspectRatio(
        aspectRatio: 1.05,
        child: AdaptiveImage(
          imageUrl: null,
          aspectRatio: 1.05,
        ),
      );
    }

    return Column(
      children: [
        AspectRatio(
          aspectRatio: 1.05,
          child: PageView.builder(
            controller: _imagePageController,
            itemCount: images.length,
            onPageChanged: (index) =>
                setState(() => _selectedImageIndex = index),
            itemBuilder: (context, index) {
              final img = images[index];
              return AdaptiveImage(
                imageUrl: img.url,
                aspectRatio: 1.05,
                heroTag: index == 0 ? 'product-image-${widget.productId}' : null,
              );
            },
          ),
        ),
        if (images.length > 1) ...[
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(images.length, (index) {
              final isCurrent = index == _selectedImageIndex;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                width: isCurrent ? 20 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: isCurrent
                      ? AppColors.cobalt
                      : Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(3),
                ),
              );
            }),
          ),
        ],
      ],
    );
  }

  Widget _buildStockAvailabilityCard(ProductVariant? variant) {
    if (_selectedSize == null && _selectedColor == null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.line),
        ),
        child: const Row(
          children: [
            Icon(
              Icons.info_outline_rounded,
              color: AppColors.cobalt,
              size: 20,
            ),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'Selecciona una talla o color para consultar disponibilidad en existencias.',
                style: TextStyle(color: AppColors.inkSoft, fontSize: 13),
              ),
            ),
          ],
        ),
      );
    }

    if (variant == null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.line),
        ),
        child: const Row(
          children: [
            Icon(
              Icons.search_off_rounded,
              color: AppColors.inkSoft,
              size: 20,
            ),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'No hay una variante activa registrada con esa combinación de talla y color.',
                style: TextStyle(color: AppColors.inkSoft, fontSize: 13),
              ),
            ),
          ],
        ),
      );
    }

    final stock = variant.stock ?? 0;
    final hasStock = stock > 0;
    final skuText = (variant.sku != null && variant.sku!.isNotEmpty)
        ? variant.sku!
        : 'SKU-${variant.id}';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: hasStock ? const Color(0xFF10B981) : AppColors.line,
          width: hasStock ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                hasStock ? Icons.check_circle_rounded : Icons.cancel_outlined,
                color: hasStock ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  hasStock
                      ? 'Disponible en inventario: $stock unidades'
                      : 'Agotado actualmente',
                  style: TextStyle(
                    color: hasStock ? AppColors.ink : const Color(0xFFEF4444),
                    fontWeight: FontWeight.w800,
                    fontSize: 13.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'SKU: $skuText · Talla: ${variant.size} · Color: ${variant.color}',
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.inkSoft,
            ),
          ),
          if (variant.stockStatus != null) ...[
            const SizedBox(height: 4),
            Text(
              'Estado: ${variant.stockStatus}',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.inkSoft,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMeasurementsSection(List<ProductMeasurement> measurements) {
    if (measurements.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.straighten_rounded, size: 20),
                const SizedBox(width: 8),
                Text(
                  'Guía de medidas (cm)',
                  style: Theme.of(context).textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                columnSpacing: 18,
                horizontalMargin: 8,
                columns: const [
                  DataColumn(
                    label: Text(
                      'Talla',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'Hombros',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'Pecho',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'Largo',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  DataColumn(
                    label: Text(
                      'Manga',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
                rows: measurements.map((m) {
                  return DataRow(
                    cells: [
                      DataCell(
                        Text(
                          m.size,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                      DataCell(
                        Text(m.shouldersCm != null ? '${m.shouldersCm}' : '-'),
                      ),
                      DataCell(Text(m.chestCm != null ? '${m.chestCm}' : '-')),
                      DataCell(
                        Text(m.lengthCm != null ? '${m.lengthCm}' : '-'),
                      ),
                      DataCell(
                        Text(m.sleeveCm != null ? '${m.sleeveCm}' : '-'),
                      ),
                    ],
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductDetailData {
  const _ProductDetailData({
    required this.product,
    required this.images,
    required this.variants,
    required this.measurements,
  });

  final Product product;
  final List<ProductImage> images;
  final List<ProductVariant> variants;
  final List<ProductMeasurement> measurements;
}
