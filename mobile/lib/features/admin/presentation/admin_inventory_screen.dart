import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/admin/domain/admin_models.dart';
import 'package:capricho_store/features/admin/presentation/admin_controller.dart';
import 'package:capricho_store/shared/widgets/message_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AdminInventoryScreen extends ConsumerStatefulWidget {
  const AdminInventoryScreen({super.key});

  @override
  ConsumerState<AdminInventoryScreen> createState() =>
      _AdminInventoryScreenState();
}

class _AdminInventoryScreenState extends ConsumerState<AdminInventoryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  int? _selectedBranchId;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(48),
        child: Container(
          decoration: const BoxDecoration(
            color: AppColors.canvas,
            border: Border(
              bottom: BorderSide(color: AppColors.line, width: 1),
            ),
          ),
          child: TabBar(
            controller: _tabController,
            indicatorColor: AppColors.cobalt,
            indicatorWeight: 2.5,
            labelColor: AppColors.cobalt,
            unselectedLabelColor: AppColors.inkSoft,
            labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            tabs: const [
              Tab(
                icon: Icon(Icons.warning_amber_rounded, size: 18),
                text: 'Stock bajo',
              ),
              Tab(
                icon: Icon(Icons.store_mall_directory_outlined, size: 18),
                text: 'Consultar sucursal',
              ),
            ],
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildLowStockTab(),
          _buildBranchStockTab(),
        ],
      ),
    );
  }

  Widget _buildLowStockTab() {
    final asyncItems = ref.watch(adminLowStockProvider(null));

    return RefreshIndicator(
      onRefresh: () async => ref.refresh(adminLowStockProvider(null).future),
      color: AppColors.cobalt,
      child: asyncItems.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => MessageState(
          title: 'Error al consultar stock bajo',
          message: err.toString(),
          onRetry: () => ref.refresh(adminLowStockProvider(null)),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.check_circle_outline_rounded,
                      color: Color(0xFF10B981),
                      size: 48,
                    ),
                    SizedBox(height: 12),
                    Text(
                      'No hay variantes en stock crítico',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                        color: AppColors.ink,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Todas las prendas tienen existencias por encima de su umbral mínimo.',
                      style: TextStyle(color: AppColors.inkSoft, fontSize: 12),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            itemBuilder: (context, index) =>
                _buildInventoryCard(context, items[index]),
          );
        },
      ),
    );
  }

  Widget _buildBranchStockTab() {
    final branchesAsync = ref.watch(adminBranchesProvider);

    return branchesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => MessageState(
        title: 'Error al cargar sucursales',
        message: err.toString(),
        onRetry: () => ref.refresh(adminBranchesProvider),
      ),
      data: (branches) {
        if (branches.isEmpty) {
          return const Center(
            child: Text('No existen sucursales registradas.'),
          );
        }

        final effectiveBranchId = _selectedBranchId ?? branches.first.id;
        final stockAsync = ref.watch(adminBranchInventoryProvider(effectiveBranchId));

        return Column(
          children: [
            // Selector de Sucursal
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(
                  bottom: BorderSide(color: AppColors.line, width: 1),
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.location_on_outlined,
                    color: AppColors.cobalt,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Sucursal:',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: AppColors.ink,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: AppColors.canvas,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.line),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<int>(
                          value: effectiveBranchId,
                          isExpanded: true,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink,
                          ),
                          items: branches.map((b) {
                            return DropdownMenuItem<int>(
                              value: b.id,
                              child: Text(b.name, overflow: TextOverflow.ellipsis),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setState(() => _selectedBranchId = val);
                            }
                          },
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Lista de inventario
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async =>
                    ref.refresh(adminBranchInventoryProvider(effectiveBranchId).future),
                color: AppColors.cobalt,
                child: stockAsync.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (err, _) => MessageState(
                    title: 'Error al cargar inventario',
                    message: err.toString(),
                    onRetry: () =>
                        ref.refresh(adminBranchInventoryProvider(effectiveBranchId)),
                  ),
                  data: (items) {
                    if (items.isEmpty) {
                      return const Center(
                        child: Text(
                          'No hay existencias registradas en esta sucursal.',
                          style: TextStyle(color: AppColors.inkSoft),
                        ),
                      );
                    }

                    return ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: items.length,
                      itemBuilder: (context, index) =>
                          _buildInventoryCard(context, items[index]),
                    );
                  },
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildInventoryCard(BuildContext context, InventoryStockItem item) {
    Color statusColor;
    String statusLabel;

    if (item.isOutOfStock) {
      statusColor = const Color(0xFFEF4444);
      statusLabel = 'AGOTADO';
    } else if (item.isLowStock) {
      statusColor = const Color(0xFFF59E0B);
      statusLabel = 'STOCK BAJO';
    } else {
      statusColor = const Color(0xFF10B981);
      statusLabel = 'DISPONIBLE';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: item.isLowStock ? statusColor.withValues(alpha: 0.5) : AppColors.line,
          width: item.isLowStock ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.sku,
                      style: const TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        color: AppColors.cobalt,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.productName,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    color: statusColor,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _buildBadge('Talla: ${item.size}'),
              const SizedBox(width: 6),
              _buildBadge('Color: ${item.color}'),
              const SizedBox(width: 6),
              _buildBadge('Cat: ${item.category}'),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Disponible',
                    style: TextStyle(fontSize: 11, color: AppColors.inkSoft),
                  ),
                  Text(
                    '${item.availableStock} unid.',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: statusColor,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Mínimo',
                    style: TextStyle(fontSize: 11, color: AppColors.inkSoft),
                  ),
                  Text(
                    '${item.minStock} unid.',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Físico / Res.',
                    style: TextStyle(fontSize: 11, color: AppColors.inkSoft),
                  ),
                  Text(
                    '${item.physicalStock} / ${item.reservedStock}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.inkSoft,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    'Sucursal',
                    style: TextStyle(fontSize: 11, color: AppColors.inkSoft),
                  ),
                  Text(
                    item.branchName,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBadge(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.muted,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: AppColors.line),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w600,
          color: AppColors.ink,
        ),
      ),
    );
  }
}
