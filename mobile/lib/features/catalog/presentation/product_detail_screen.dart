import 'package:cached_network_image/cached_network_image.dart';
import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/catalog/data/catalog_repository.dart';
import 'package:capricho_store/features/catalog/domain/catalog_models.dart';
import 'package:capricho_store/shared/widgets/message_state.dart';
import 'package:flutter/material.dart';
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
  late Future<Product> request;
  String? size;
  String? color;

  @override
  void initState() {
    super.initState();
    request = ref.read(catalogRepositoryProvider).product(widget.productId);
  }

  void retry() => setState(() {
    request = ref.read(catalogRepositoryProvider).product(widget.productId);
  });

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Detalle')),
    body: FutureBuilder<Product>(
      future: request,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return MessageState(
            title: 'No pudimos abrir la prenda',
            message: snapshot.error.toString(),
            onRetry: retry,
          );
        }
        final product = snapshot.data!;
        final price = product.price == null
            ? 'Precio no disponible'
            : NumberFormat.currency(
                symbol: 'Bs ',
                decimalDigits: 2,
              ).format(product.price);
        return ListView(
          padding: const EdgeInsets.only(bottom: 32),
          children: [
            AspectRatio(
              aspectRatio: .82,
              child: product.image == null
                  ? const ColoredBox(
                      color: AppColors.muted,
                      child: Center(
                        child: Icon(
                          Icons.checkroom_rounded,
                          size: 72,
                          color: AppColors.inkSoft,
                        ),
                      ),
                    )
                  : CachedNetworkImage(
                      imageUrl: product.image!.url,
                      fit: BoxFit.cover,
                      placeholder: (context, url) =>
                          const ColoredBox(color: AppColors.muted),
                      errorWidget: (context, url, error) => const ColoredBox(
                        color: AppColors.muted,
                        child: Center(
                          child: Icon(Icons.broken_image_outlined, size: 48),
                        ),
                      ),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${product.category} · ${product.audience}',
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    product.name,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 6),
                  Text(price, style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 18),
                  Text(
                    product.description?.trim().isNotEmpty == true
                        ? product.description!
                        : 'Sin descripción disponible.',
                  ),
                  if (product.sizes.isNotEmpty) ...[
                    const SizedBox(height: 26),
                    Text(
                      'Talla',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      children: product.sizes
                          .map(
                            (value) => ChoiceChip(
                              label: Text(value),
                              selected: size == value,
                              onSelected: (_) => setState(() => size = value),
                            ),
                          )
                          .toList(),
                    ),
                  ],
                  if (product.colors.isNotEmpty) ...[
                    const SizedBox(height: 22),
                    Text(
                      'Color',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: product.colors
                          .map(
                            (value) => ChoiceChip(
                              label: Text(value),
                              selected: color == value,
                              onSelected: (_) => setState(() => color = value),
                            ),
                          )
                          .toList(),
                    ),
                  ],
                  const SizedBox(height: 26),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: product.fittingEnabled
                          ? const Color(0xFFDDE7FF)
                          : AppColors.muted,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          product.fittingEnabled
                              ? Icons.accessibility_new_rounded
                              : Icons.info_outline_rounded,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                product.fittingEnabled
                                    ? 'Compatible con vestidor virtual'
                                    : 'Vestidor no disponible para esta prenda',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              if (product.fittingEnabled)
                                const Text(
                                  'La experiencia con cámara se habilitará en una etapa posterior.',
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    ),
  );
}
