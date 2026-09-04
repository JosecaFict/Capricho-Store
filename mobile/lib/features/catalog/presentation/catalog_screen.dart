import 'package:cached_network_image/cached_network_image.dart';
import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/catalog/data/catalog_repository.dart';
import 'package:capricho_store/features/catalog/domain/catalog_models.dart';
import 'package:capricho_store/shared/widgets/brand_wordmark.dart';
import 'package:capricho_store/shared/widgets/message_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class CatalogScreen extends ConsumerStatefulWidget {
  const CatalogScreen({super.key});
  @override
  ConsumerState<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends ConsumerState<CatalogScreen> {
  CatalogQuery query = const CatalogQuery();
  late Future<ProductPage> request;

  static const categories = ['POLERA', 'CAMISA', 'POLO', 'BLUSA'];

  @override
  void initState() {
    super.initState();
    request = _load();
  }

  Future<ProductPage> _load() =>
      ref.read(catalogRepositoryProvider).products(query);

  void _setQuery(CatalogQuery next) {
    setState(() {
      query = next;
      request = _load();
    });
  }

  Future<void> _filters() async {
    var category = query.category;
    var audience = query.audience;
    final result = await showModalBottomSheet<(String?, String?)>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              4,
              20,
              20 + MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Filtrar catálogo',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 20),
                DropdownButtonFormField<String?>(
                  initialValue: category,
                  decoration: const InputDecoration(labelText: 'Categoría'),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('Todas')),
                    ...categories.map(
                      (value) =>
                          DropdownMenuItem(value: value, child: Text(value)),
                    ),
                  ],
                  onChanged: (value) => setSheetState(() => category = value),
                ),
                const SizedBox(height: 12),
                SegmentedButton<String?>(
                  segments: const [
                    ButtonSegment(value: null, label: Text('Todos')),
                    ButtonSegment(value: 'HOMBRE', label: Text('Hombre')),
                    ButtonSegment(value: 'MUJER', label: Text('Mujer')),
                  ],
                  selected: {audience},
                  onSelectionChanged: (values) =>
                      setSheetState(() => audience = values.first),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: () => Navigator.pop(context, (category, audience)),
                  child: const Text('Ver resultados'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context, (null, null)),
                  child: const Text('Limpiar filtros'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (result != null) {
      _setQuery(
        CatalogQuery(
          category: result.$1,
          audience: result.$2,
          sort: query.sort,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) => CustomScrollView(
    slivers: [
      const SliverAppBar(floating: true, title: BrandWordmark(compact: true)),
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
        sliver: SliverList.list(
          children: [
            Text(
              'PRENDAS PARA\nTU RITMO',
              style: Theme.of(context).textTheme.displaySmall,
            ),
            const SizedBox(height: 10),
            const Text(
              'Poleras, camisas, polos y blusas disponibles en Capricho Store.',
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _filters,
                    icon: const Icon(Icons.tune_rounded),
                    label: Text(query.category ?? 'Filtros'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: query.sort,
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.swap_vert_rounded),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'nombre', child: Text('Nombre')),
                      DropdownMenuItem(
                        value: 'precio',
                        child: Text('Menor precio'),
                      ),
                      DropdownMenuItem(
                        value: '-precio',
                        child: Text('Mayor precio'),
                      ),
                      DropdownMenuItem(
                        value: '-created_at',
                        child: Text('Novedades'),
                      ),
                    ],
                    onChanged: (value) {
                      if (value != null) {
                        _setQuery(
                          CatalogQuery(
                            category: query.category,
                            audience: query.audience,
                            sort: value,
                          ),
                        );
                      }
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      FutureBuilder<ProductPage>(
        future: request,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator()),
            );
          }
          if (snapshot.hasError) {
            return SliverFillRemaining(
              child: MessageState(
                title: 'El catálogo no cargó',
                message: snapshot.error.toString(),
                onRetry: () => _setQuery(query),
              ),
            );
          }
          final page = snapshot.data!;
          if (page.items.isEmpty) {
            return const SliverFillRemaining(
              child: MessageState(
                title: 'Sin resultados',
                message: 'Prueba con otra categoría o público.',
              ),
            );
          }
          return SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            sliver: SliverGrid.builder(
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 260,
                mainAxisExtent: 330,
                crossAxisSpacing: 12,
                mainAxisSpacing: 20,
              ),
              itemCount: page.items.length,
              itemBuilder: (context, index) =>
                  _ProductCard(product: page.items[index]),
            ),
          );
        },
      ),
    ],
  );
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product});
  final Product product;

  @override
  Widget build(BuildContext context) {
    final price = product.price == null
        ? 'Precio no disponible'
        : NumberFormat.currency(
            symbol: 'Bs ',
            decimalDigits: 2,
          ).format(product.price);
    return Semantics(
      button: true,
      label: '${product.name}, $price',
      child: InkWell(
        onTap: () => context.push('/productos/${product.id}'),
        borderRadius: BorderRadius.circular(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: product.image == null
                    ? const ColoredBox(
                        color: AppColors.muted,
                        child: Center(
                          child: Icon(
                            Icons.checkroom_rounded,
                            size: 42,
                            color: AppColors.inkSoft,
                          ),
                        ),
                      )
                    : CachedNetworkImage(
                        imageUrl: product.image!.url,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        placeholder: (context, url) =>
                            const ColoredBox(color: AppColors.muted),
                        errorWidget: (context, url, error) => const ColoredBox(
                          color: AppColors.muted,
                          child: Center(
                            child: Icon(Icons.broken_image_outlined),
                          ),
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              '${product.category} · ${product.audience}',
              style: Theme.of(context).textTheme.labelSmall,
            ),
            const SizedBox(height: 3),
            Text(
              product.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            Text(price, style: const TextStyle(color: AppColors.inkSoft)),
          ],
        ),
      ),
    );
  }
}
