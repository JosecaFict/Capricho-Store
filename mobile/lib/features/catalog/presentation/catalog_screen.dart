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

  List<CategoryItem> _availableCategories = [];
  List<BrandItem> _availableBrands = [];
  List<SizeItem> _availableSizes = [];
  List<ColorItem> _availableColors = [];
  List<SeasonItem> _availableSeasons = [];

  @override
  void initState() {
    super.initState();
    _loadMetadata();
    request = _load();
  }

  Future<void> _loadMetadata() async {
    final repo = ref.read(catalogRepositoryProvider);
    try {
      final results = await Future.wait([
        repo.categories(),
        repo.brands(),
        repo.sizes(),
        repo.colors(),
        repo.seasons(),
      ]);
      if (mounted) {
        setState(() {
          _availableCategories = results[0] as List<CategoryItem>;
          _availableBrands = results[1] as List<BrandItem>;
          _availableSizes = results[2] as List<SizeItem>;
          _availableColors = results[3] as List<ColorItem>;
          _availableSeasons = results[4] as List<SeasonItem>;
        });
      }
    } catch (_) {
      // Ignorar fallo de metadatos si no hay conexión, se reintentará en el refresh
    }
  }

  Future<ProductPage> _load() =>
      ref.read(catalogRepositoryProvider).products(query);

  void _setQuery(CatalogQuery next) {
    setState(() {
      query = next;
      request = _load();
    });
  }

  Future<void> _refresh() async {
    _loadMetadata();
    _setQuery(query);
    await request;
  }

  Future<void> _openFiltersSheet() async {
    var tempCategory = query.category;
    var tempAudience = query.audience;
    var tempBrand = query.brand;
    var tempSize = query.size;
    var tempColor = query.color;
    var tempSeason = query.season;

    final result = await showModalBottomSheet<CatalogQuery>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => DraggableScrollableSheet(
          initialChildSize: 0.75,
          minChildSize: 0.5,
          maxChildSize: 0.92,
          expand: false,
          builder: (context, scrollController) => SafeArea(
            child: ListView(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Filtrar Catálogo',
                      style: Theme.of(context).textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    TextButton(
                      onPressed: () {
                        setSheetState(() {
                          tempCategory = null;
                          tempAudience = null;
                          tempBrand = null;
                          tempSize = null;
                          tempColor = null;
                          tempSeason = null;
                        });
                      },
                      child: const Text('Limpiar todo'),
                    ),
                  ],
                ),
                const Divider(),
                const SizedBox(height: 10),

                // Público Objetivo
                _buildFilterLabel('Público Objetivo'),
                SegmentedButton<String?>(
                  segments: const [
                    ButtonSegment(value: null, label: Text('Todos')),
                    ButtonSegment(value: 'MUJER', label: Text('Mujer')),
                    ButtonSegment(value: 'HOMBRE', label: Text('Hombre')),
                  ],
                  selected: {tempAudience},
                  onSelectionChanged: (values) =>
                      setSheetState(() => tempAudience = values.first),
                ),
                const SizedBox(height: 18),

                // Categoría
                _buildFilterLabel('Categoría'),
                DropdownButtonFormField<String?>(
                  initialValue: tempCategory,
                  decoration: const InputDecoration(
                    hintText: 'Todas las categorías',
                    prefixIcon: Icon(Icons.category_outlined),
                  ),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('Todas')),
                    ..._availableCategories.map(
                      (c) =>
                          DropdownMenuItem(value: c.name, child: Text(c.name)),
                    ),
                  ],
                  onChanged: (val) => setSheetState(() => tempCategory = val),
                ),
                const SizedBox(height: 18),

                // Marca (si existen marcas registradas)
                if (_availableBrands.isNotEmpty) ...[
                  _buildFilterLabel('Marca'),
                  DropdownButtonFormField<String?>(
                    initialValue: tempBrand,
                    decoration: const InputDecoration(
                      hintText: 'Todas las marcas',
                      prefixIcon: Icon(Icons.branding_watermark_outlined),
                    ),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('Todas')),
                      ..._availableBrands.map(
                        (b) => DropdownMenuItem(
                          value: b.name,
                          child: Text(b.name),
                        ),
                      ),
                    ],
                    onChanged: (val) => setSheetState(() => tempBrand = val),
                  ),
                  const SizedBox(height: 18),
                ],

                // Tallas
                if (_availableSizes.isNotEmpty) ...[
                  _buildFilterLabel('Talla'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ChoiceChip(
                        label: const Text('Todas'),
                        selected: tempSize == null,
                        onSelected: (selected) {
                          if (selected) setSheetState(() => tempSize = null);
                        },
                      ),
                      ..._availableSizes.map((s) {
                        final isSelected = tempSize == s.name;
                        return ChoiceChip(
                          label: Text(s.name),
                          selected: isSelected,
                          onSelected: (selected) {
                            setSheetState(
                              () => tempSize = selected ? s.name : null,
                            );
                          },
                        );
                      }),
                    ],
                  ),
                  const SizedBox(height: 18),
                ],

                // Colores
                if (_availableColors.isNotEmpty) ...[
                  _buildFilterLabel('Color'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ChoiceChip(
                        label: const Text('Todos'),
                        selected: tempColor == null,
                        onSelected: (selected) {
                          if (selected) setSheetState(() => tempColor = null);
                        },
                      ),
                      ..._availableColors.map((c) {
                        final isSelected = tempColor == c.name;
                        Color? dotColor;
                        if (c.hex != null) {
                          final hexClean = c.hex!.replaceAll('#', '');
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
                          label: Text(c.name),
                          selected: isSelected,
                          onSelected: (selected) {
                            setSheetState(
                              () => tempColor = selected ? c.name : null,
                            );
                          },
                        );
                      }),
                    ],
                  ),
                  const SizedBox(height: 18),
                ],

                // Temporada
                if (_availableSeasons.isNotEmpty) ...[
                  _buildFilterLabel('Temporada'),
                  DropdownButtonFormField<String?>(
                    initialValue: tempSeason,
                    decoration: const InputDecoration(
                      hintText: 'Todas las temporadas',
                      prefixIcon: Icon(Icons.wb_sunny_outlined),
                    ),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('Todas')),
                      ..._availableSeasons.map(
                        (s) => DropdownMenuItem(
                          value: s.name,
                          child: Text(s.name),
                        ),
                      ),
                    ],
                    onChanged: (val) => setSheetState(() => tempSeason = val),
                  ),
                  const SizedBox(height: 18),
                ],

                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () {
                    Navigator.pop(
                      sheetContext,
                      query.copyWith(
                        category: tempCategory,
                        clearCategory: tempCategory == null,
                        audience: tempAudience,
                        clearAudience: tempAudience == null,
                        brand: tempBrand,
                        clearBrand: tempBrand == null,
                        size: tempSize,
                        clearSize: tempSize == null,
                        color: tempColor,
                        clearColor: tempColor == null,
                        season: tempSeason,
                        clearSeason: tempSeason == null,
                        page: 1, // Reiniciar a página 1 tras filtrar
                      ),
                    );
                  },
                  child: const Text('Aplicar Filtros'),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    if (result != null) {
      _setQuery(result);
    }
  }

  Widget _buildFilterLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        label,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.currency(locale: 'es_BO', symbol: 'Bs.');

    return Scaffold(
      appBar: AppBar(
        title: const BrandWordmark(compact: true),
        centerTitle: false,
        actions: [
          IconButton(
            tooltip: 'Filtros',
            icon: Badge(
              isLabelVisible: query.hasActiveFilters,
              child: const Icon(Icons.tune_rounded),
            ),
            onPressed: _openFiltersSheet,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: AppColors.line, height: 1),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              sliver: SliverList.list(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _openFiltersSheet,
                          icon: Badge(
                            isLabelVisible: query.hasActiveFilters,
                            child: const Icon(Icons.tune_rounded, size: 18),
                          ),
                          label: Text(
                            query.hasActiveFilters
                                ? 'Filtros activos'
                                : 'Todos los filtros',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: query.sort,
                          decoration: const InputDecoration(
                            prefixIcon: Icon(Icons.swap_vert_rounded, size: 20),
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 10,
                            ),
                          ),
                          items: const [
                            DropdownMenuItem(
                              value: 'nombre',
                              child: Text('Nombre A-Z'),
                            ),
                            DropdownMenuItem(
                              value: '-nombre',
                              child: Text('Nombre Z-A'),
                            ),
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
                          onChanged: (val) {
                            if (val != null) {
                              _setQuery(query.copyWith(sort: val, page: 1));
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                  if (query.hasActiveFilters) ...[
                    const SizedBox(height: 10),
                    _buildActiveFilterChips(),
                  ],
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
                      title: 'El catálogo no pudo cargar',
                      message: snapshot.error.toString(),
                      onRetry: _refresh,
                    ),
                  );
                }

                final page = snapshot.data!;
                if (page.items.isEmpty) {
                  return SliverFillRemaining(
                    child: Center(
                      child: Container(
                        margin: const EdgeInsets.all(24),
                        padding: const EdgeInsets.symmetric(
                          vertical: 32,
                          horizontal: 20,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.line),
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.inventory_2_outlined,
                              size: 44,
                              color: AppColors.inkSoft,
                            ),
                            const SizedBox(height: 14),
                            Text(
                              query.hasActiveFilters
                                  ? 'No hay prendas con estos filtros'
                                  : 'Aún no hay productos publicados',
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                                color: AppColors.ink,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              query.hasActiveFilters
                                  ? 'Prueba quitando uno o más filtros para ampliar la búsqueda.'
                                  : 'Cuando el catálogo tenga productos activos, aparecerán aquí.',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: AppColors.inkSoft,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 20),
                            if (query.hasActiveFilters)
                              FilledButton(
                                onPressed: () {
                                  _setQuery(const CatalogQuery());
                                },
                                child: const Text('Limpiar filtros'),
                              )
                            else
                              OutlinedButton.icon(
                                onPressed: _refresh,
                                icon: const Icon(Icons.refresh_rounded, size: 18),
                                label: const Text('Actualizar'),
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                }

                return SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  sliver: SliverGrid(
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 14,
                          childAspectRatio: 0.64,
                        ),
                    delegate: SliverChildBuilderDelegate((context, index) {
                      final product = page.items[index];
                      return _CatalogProductCard(
                        product: product,
                        currency: currency,
                      );
                    }, childCount: page.items.length),
                  ),
                );
              },
            ),
            // Controles de paginación
            SliverToBoxAdapter(
              child: FutureBuilder<ProductPage>(
                future: request,
                builder: (context, snapshot) {
                  if (!snapshot.hasData) return const SizedBox.shrink();
                  final page = snapshot.data!;
                  if (page.pages <= 1) return const SizedBox.shrink();

                  return Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        OutlinedButton.icon(
                          onPressed: query.page > 1
                              ? () => _setQuery(
                                  query.copyWith(page: query.page - 1),
                                )
                              : null,
                          icon: const Icon(Icons.chevron_left_rounded),
                          label: const Text('Anterior'),
                        ),
                        Text(
                          'Página ${page.page} de ${page.pages}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        OutlinedButton.icon(
                          onPressed: query.page < page.pages
                              ? () => _setQuery(
                                  query.copyWith(page: query.page + 1),
                                )
                              : null,
                          icon: const Icon(Icons.chevron_right_rounded),
                          label: const Text('Siguiente'),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveFilterChips() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          if (query.category != null)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: Chip(
                label: Text('Cat: ${query.category}'),
                onDeleted: () =>
                    _setQuery(query.copyWith(clearCategory: true, page: 1)),
              ),
            ),
          if (query.audience != null)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: Chip(
                label: Text(query.audience == 'MUJER' ? 'Mujer' : 'Hombre'),
                onDeleted: () =>
                    _setQuery(query.copyWith(clearAudience: true, page: 1)),
              ),
            ),
          if (query.brand != null)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: Chip(
                label: Text('Marca: ${query.brand}'),
                onDeleted: () =>
                    _setQuery(query.copyWith(clearBrand: true, page: 1)),
              ),
            ),
          if (query.size != null)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: Chip(
                label: Text('Talla: ${query.size}'),
                onDeleted: () =>
                    _setQuery(query.copyWith(clearSize: true, page: 1)),
              ),
            ),
          if (query.color != null)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: Chip(
                label: Text('Color: ${query.color}'),
                onDeleted: () =>
                    _setQuery(query.copyWith(clearColor: true, page: 1)),
              ),
            ),
          if (query.season != null)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: Chip(
                label: Text('Temp: ${query.season}'),
                onDeleted: () =>
                    _setQuery(query.copyWith(clearSeason: true, page: 1)),
              ),
            ),
          TextButton(
            onPressed: () => _setQuery(const CatalogQuery()),
            child: const Text('Borrar todos'),
          ),
        ],
      ),
    );
  }
}

class _CatalogProductCard extends StatelessWidget {
  const _CatalogProductCard({required this.product, required this.currency});
  final Product product;
  final NumberFormat currency;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push('/productos/${product.id}'),
      borderRadius: BorderRadius.circular(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.muted,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.line),
              ),
              clipBehavior: Clip.antiAlias,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (product.image?.url != null &&
                      product.image!.url.isNotEmpty)
                    CachedNetworkImage(
                      imageUrl: product.image!.url,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Container(
                        color: AppColors.muted,
                        child: const Center(
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      ),
                      errorWidget: (context, url, error) => Container(
                        color: AppColors.muted,
                        child: const Icon(
                          Icons.image_not_supported_outlined,
                          color: AppColors.inkSoft,
                        ),
                      ),
                    )
                  else
                    Container(
                      color: AppColors.muted,
                      child: const Icon(
                        Icons.checkroom_rounded,
                        size: 38,
                        color: AppColors.inkSoft,
                      ),
                    ),
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xD0121418),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        product.audience,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 8.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 8, left: 2, right: 2),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.brand.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.cobalt,
                    letterSpacing: 0.5,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  product.name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: AppColors.ink,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (product.sizes.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Tallas: ${product.sizes.join(', ')}',
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.inkSoft,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 3),
                Text(
                  product.price != null
                      ? currency.format(product.price)
                      : 'Precio por definir',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                    color: product.price != null
                        ? AppColors.cobaltDark
                        : AppColors.inkSoft,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
