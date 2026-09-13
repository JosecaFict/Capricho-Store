import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/admin/domain/admin_models.dart';
import 'package:capricho_store/features/admin/domain/operational_access.dart';
import 'package:capricho_store/features/admin/presentation/admin_controller.dart';
import 'package:capricho_store/features/auth/domain/app_user.dart';
import 'package:capricho_store/features/auth/presentation/auth_controller.dart';
import 'package:capricho_store/features/commerce/domain/commerce_models.dart';
import 'package:capricho_store/shared/widgets/message_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

class AdminOperationsScreen extends ConsumerStatefulWidget {
  const AdminOperationsScreen({super.key});

  @override
  ConsumerState<AdminOperationsScreen> createState() =>
      _AdminOperationsScreenState();
}

class _AdminOperationsScreenState extends ConsumerState<AdminOperationsScreen> {
  String? _orderStatusFilter;
  int? _orderBranchFilter;
  String _orderSearchQuery = '';

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user!;
    final showOrders = user.canManageOrders;
    final showPurchases = user.canViewPurchaseOrders || user.canViewReceipts;
    final showTransfers = user.canViewTransfers;
    final tabCount = (showOrders ? 1 : 0) + (showPurchases ? 1 : 0) + (showTransfers ? 1 : 0);

    return DefaultTabController(
      length: tabCount,
      child: Scaffold(
        appBar: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: Container(
            decoration: const BoxDecoration(
              color: AppColors.canvas,
              border: Border(
                bottom: BorderSide(color: AppColors.line, width: 1),
              ),
            ),
            child: TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              indicatorColor: AppColors.cobalt,
              indicatorWeight: 2.5,
              labelColor: AppColors.cobalt,
              unselectedLabelColor: AppColors.inkSoft,
              labelStyle: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
              tabs: [
                if (showOrders)
                  const Tab(
                    icon: Icon(Icons.storefront_rounded, size: 20),
                    text: 'Entregas en tienda',
                  ),
                if (showPurchases)
                  const Tab(
                    icon: Icon(Icons.shopping_cart_outlined, size: 20),
                    text: 'Compras y recepciones',
                  ),
                if (showTransfers)
                  const Tab(
                    icon: Icon(Icons.swap_horiz_rounded, size: 20),
                    text: 'Transferencias',
                  ),
              ],
            ),
          ),
        ),
        body: TabBarView(
          children: [
            if (showOrders) _buildStoreOrdersTab(user),
            if (showPurchases)
              _buildPurchasesTab(
                showOrders: user.canViewPurchaseOrders,
                showReceipts: user.canViewReceipts,
              ),
            if (showTransfers)
              _buildTransfersTab(canManage: user.canManageInventory),
          ],
        ),
      ),
    );
  }

  Widget _buildPurchasesTab({
    required bool showOrders,
    required bool showReceipts,
  }) {
    final ordersAsync = showOrders
        ? ref.watch(adminPurchaseOrdersProvider)
        : null;
    final receiptsAsync = showReceipts
        ? ref.watch(adminReceiptsProvider)
        : null;
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([
          if (showOrders) ref.refresh(adminPurchaseOrdersProvider.future),
          if (showReceipts) ref.refresh(adminReceiptsProvider.future),
        ]);
      },
      color: AppColors.cobalt,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (showOrders) ...[
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Órdenes de compra',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: AppColors.ink,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Pendientes y en tránsito',
                  style: TextStyle(fontSize: 12, color: AppColors.inkSoft),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ordersAsync!.when(
              loading: () => const Center(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: CircularProgressIndicator(),
                ),
              ),
              error: (err, _) => MessageState(
                title: 'Error al cargar órdenes de compra',
                message: err.toString(),
              ),
              data: (orders) {
                if (orders.isEmpty) {
                  return _buildEmptyBox(
                    'No hay órdenes de compra registradas.',
                  );
                }
                return Column(
                  children: orders
                      .map(
                        (order) => _buildPurchaseOrderCard(order, dateFormat),
                      )
                      .toList(),
                );
              },
            ),
            if (showReceipts) const SizedBox(height: 24),
          ],

          if (showReceipts) ...[
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Recepciones recientes',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: AppColors.ink,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Historial de ingresos',
                  style: TextStyle(fontSize: 12, color: AppColors.inkSoft),
                ),
              ],
            ),
            const SizedBox(height: 10),
            receiptsAsync!.when(
              loading: () => const Center(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: CircularProgressIndicator(),
                ),
              ),
              error: (err, _) => MessageState(
                title: 'Error al cargar recepciones',
                message: err.toString(),
              ),
              data: (receipts) {
                if (receipts.isEmpty) {
                  return _buildEmptyBox(
                    'No se han registrado recepciones aún.',
                  );
                }
                return Column(
                  children: receipts
                      .map((receipt) => _buildReceiptCard(receipt, dateFormat))
                      .toList(),
                );
              },
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTransfersTab({required bool canManage}) {
    final transfersAsync = ref.watch(adminTransfersProvider);
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

    return RefreshIndicator(
      onRefresh: () async => ref.refresh(adminTransfersProvider.future),
      color: AppColors.cobalt,
      child: transfersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => MessageState(
          title: 'Error al cargar transferencias',
          message: err.toString(),
          onRetry: () => ref.refresh(adminTransfersProvider),
        ),
        data: (transfers) {
          if (transfers.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.swap_horiz_rounded,
                      size: 48,
                      color: AppColors.inkSoft,
                    ),
                    SizedBox(height: 12),
                    Text(
                      'No hay transferencias registradas',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                        color: AppColors.ink,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Cuando se despachen prendas entre sucursales aparecerán aquí.',
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
            itemCount: transfers.length,
            itemBuilder: (context, index) =>
                _buildTransferCard(transfers[index], dateFormat, canManage),
          );
        },
      ),
    );
  }

  Widget _buildPurchaseOrderCard(
    PurchaseOrderItem order,
    DateFormat dateFormat,
  ) {
    Color statusColor;
    switch (order.status) {
      case 'RECIBIDA':
        statusColor = const Color(0xFF10B981);
        break;
      case 'EN_TRANSITO':
        statusColor = AppColors.cobalt;
        break;
      case 'CANCELADA':
        statusColor = const Color(0xFFEF4444);
        break;
      default:
        statusColor = const Color(0xFFF59E0B);
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 6,
            alignment: WrapAlignment.spaceBetween,
            children: [
              Text(
                'Orden #${order.id}',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  color: AppColors.ink,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  order.status,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: statusColor,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Proveedor #${order.supplierId} · Sucursal destino #${order.branchId}',
            style: const TextStyle(fontSize: 12, color: AppColors.inkSoft),
          ),
          const SizedBox(height: 4),
          Text(
            'Fecha: ${dateFormat.format(order.orderDate)} · ${order.detailsCount} prendas',
            style: const TextStyle(fontSize: 12, color: AppColors.inkSoft),
          ),
          if (order.notes != null && order.notes!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'Nota: ${order.notes}',
              style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildReceiptCard(ReceiptItem receipt, DateFormat dateFormat) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.muted,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.inventory_rounded,
              color: AppColors.cobalt,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Recepción #${receipt.id}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13.5,
                        color: AppColors.ink,
                      ),
                    ),
                    if (receipt.purchaseOrderId != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        'De Orden #${receipt.purchaseOrderId}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.cobalt,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Sucursal #${receipt.branchId} · ${receipt.detailsCount} lotes recibidos',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.inkSoft,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  dateFormat.format(receipt.receiptDate),
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.inkSoft,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransferCard(
    TransferItem transfer,
    DateFormat dateFormat,
    bool canManage,
  ) {
    Color statusColor;
    switch (transfer.status) {
      case 'RECIBIDA':
        statusColor = const Color(0xFF10B981);
        break;
      case 'ENVIADA':
        statusColor = AppColors.cobalt;
        break;
      case 'CANCELADA':
        statusColor = const Color(0xFFEF4444);
        break;
      default:
        statusColor = const Color(0xFFF59E0B);
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 6,
            alignment: WrapAlignment.spaceBetween,
            children: [
              Text(
                'Transferencia #${transfer.id}',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  color: AppColors.ink,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  transfer.status,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: statusColor,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.canvas,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Origen',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.inkSoft,
                        ),
                      ),
                      Text(
                        'Sucursal #${transfer.originBranchId}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 12.5,
                          color: AppColors.ink,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8),
                child: Icon(
                  Icons.arrow_forward_rounded,
                  color: AppColors.inkSoft,
                  size: 18,
                ),
              ),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.canvas,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Destino',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.inkSoft,
                        ),
                      ),
                      Text(
                        'Sucursal #${transfer.destinationBranchId}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 12.5,
                          color: AppColors.ink,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Solicitada: ${dateFormat.format(transfer.requestDate)} · ${transfer.detailsCount} prendas',
            style: const TextStyle(fontSize: 12, color: AppColors.inkSoft),
          ),
          if (transfer.isPending && canManage) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    onPressed: () =>
                        _confirmChangeStatus(transfer.id, 'RECIBIDA'),
                    icon: const Icon(Icons.check_rounded, size: 16),
                    label: const Text(
                      'Confirmar recepción',
                      style: TextStyle(fontSize: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFEF4444),
                    side: const BorderSide(color: Color(0xFFEF4444)),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  onPressed: () =>
                      _confirmChangeStatus(transfer.id, 'CANCELADA'),
                  child: const Text('Cancelar', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  void _confirmChangeStatus(int transferId, String newStatus) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text('¿Cambiar estado a $newStatus?'),
        content: Text(
          'La transferencia #$transferId se marcará como $newStatus en el inventario.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: const Text('Volver'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(dialogCtx);
              final messenger = ScaffoldMessenger.of(context);
              final ok = await ref
                  .read(adminOperationsNotifierProvider.notifier)
                  .updateTransferStatus(transferId, newStatus);
              if (mounted) {
                messenger.showSnackBar(
                  SnackBar(
                    content: Text(
                      ok
                          ? 'Transferencia actualizada a $newStatus.'
                          : 'No se pudo actualizar la transferencia.',
                    ),
                  ),
                );
              }
            },
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyBox(String message) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line),
      ),
      child: Center(
        child: Text(
          message,
          style: const TextStyle(fontSize: 12, color: AppColors.inkSoft),
        ),
      ),
    );
  }

  Widget _buildStoreOrdersTab(AppUser user) {
    final filter = AdminOrderFilter(
      estado: _orderStatusFilter,
      sucursal: user.isAdmin ? _orderBranchFilter : null,
    );
    final ordersAsync = ref.watch(adminOrdersProvider(filter));
    final branchesAsync = user.isAdmin ? ref.watch(adminBranchesProvider) : null;
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

    return RefreshIndicator(
      onRefresh: () async => ref.refresh(adminOrdersProvider(filter).future),
      color: AppColors.cobalt,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Buscador rápido
          TextField(
            decoration: InputDecoration(
              hintText: 'Buscar #pedido o sucursal...',
              prefixIcon: const Icon(Icons.search_rounded, size: 20),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: AppColors.line),
              ),
              filled: true,
              fillColor: AppColors.surface,
              isDense: true,
            ),
            onChanged: (val) {
              setState(() {
                _orderSearchQuery = val.trim().toLowerCase();
              });
            },
          ),
          const SizedBox(height: 10),

          // Selector de sucursal para Administrador (soporte multisucursal en saturación)
          if (user.isAdmin && branchesAsync != null)
            branchesAsync.when(
              data: (branches) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    const Icon(Icons.location_on_outlined, size: 18, color: AppColors.cobalt),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<int?>(
                        initialValue: _orderBranchFilter,
                        isExpanded: true,
                        decoration: InputDecoration(
                          labelText: 'Filtrar por Sucursal',
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: AppColors.line),
                          ),
                          filled: true,
                          fillColor: AppColors.surface,
                          isDense: true,
                        ),
                        items: [
                          const DropdownMenuItem<int?>(
                            value: null,
                            child: Text('Todas las sucursales (Global)'),
                          ),
                          ...branches.map(
                            (b) => DropdownMenuItem<int?>(
                              value: b.id,
                              child: Text(
                                b.name,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                        ],
                        onChanged: (val) {
                          setState(() {
                            _orderBranchFilter = val;
                          });
                        },
                      ),
                    ),
                  ],
                ),
              ),
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),

          // Filtro horizontal de estados
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildOrderStatusChip(label: 'Todos', value: null),
                const SizedBox(width: 6),
                _buildOrderStatusChip(label: 'Pendientes', value: 'PENDIENTE'),
                const SizedBox(width: 6),
                _buildOrderStatusChip(label: 'Preparando', value: 'PREPARANDO'),
                const SizedBox(width: 6),
                _buildOrderStatusChip(label: 'Listos para Retiro', value: 'LISTO_PARA_RETIRO'),
                const SizedBox(width: 6),
                _buildOrderStatusChip(label: 'Retirados', value: 'RETIRADO'),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Listado reactivo de pedidos
          ordersAsync.when(
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: CircularProgressIndicator(),
              ),
            ),
            error: (err, _) => MessageState(
              title: 'Error al cargar pedidos',
              message: err.toString(),
              onRetry: () => ref.refresh(adminOrdersProvider(filter)),
            ),
            data: (orders) {
              final filtered = orders.where((o) {
                if (_orderSearchQuery.isEmpty) return true;
                final idMatch = o.idPedido.toString().contains(_orderSearchQuery);
                final branchMatch = o.sucursal.toLowerCase().contains(_orderSearchQuery);
                return idMatch || branchMatch;
              }).toList();

              if (filtered.isEmpty) {
                return _buildEmptyBox('No se encontraron pedidos de tienda para los filtros seleccionados.');
              }

              return Column(
                children: filtered.map((o) => _buildStoreOrderCard(o, dateFormat)).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildOrderStatusChip({required String label, required String? value}) {
    final isSelected = _orderStatusFilter == value;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => setState(() => _orderStatusFilter = value),
      selectedColor: AppColors.cobalt,
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : AppColors.ink,
        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
        fontSize: 12,
      ),
      backgroundColor: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: isSelected ? AppColors.cobalt : AppColors.line,
        ),
      ),
    );
  }

  Widget _buildStoreOrderCard(Order order, DateFormat dateFormat) {
    final currency = NumberFormat.currency(locale: 'es_BO', symbol: 'Bs ');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Pedido #${order.idPedido}',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                  color: AppColors.ink,
                ),
              ),
              _buildOrderStatusBadge(order.estado),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.storefront_rounded, size: 16, color: AppColors.cobalt),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Sucursal ${order.sucursal}',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Fecha: ${dateFormat.format(order.fechaCreacion.toLocal())}',
            style: const TextStyle(fontSize: 12, color: AppColors.inkSoft),
          ),
          const Divider(height: 18),
          Text(
            '${order.items.length} prenda(s) en pedido:',
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5, color: AppColors.inkSoft),
          ),
          const SizedBox(height: 4),
          ...order.items.map(
            (item) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  Text('• ${item.cantidad}x ${item.producto}',
                      style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500)),
                  if (item.talla != null && item.talla!.isNotEmpty)
                    Text(' (${item.talla})', style: const TextStyle(fontSize: 12, color: AppColors.inkSoft)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total:', style: TextStyle(fontSize: 13, color: AppColors.inkSoft)),
              Text(
                currency.format(order.total),
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.cobaltDark),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Botones de acción operativa según ciclo de vida de backend
          if (order.estado == 'PENDIENTE')
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => _confirmUpdateOrderStatus(
                  order.idPedido,
                  'PREPARANDO',
                  '¿Iniciar la preparación del Pedido #${order.idPedido}?',
                ),
                icon: const Icon(Icons.inventory_2_outlined, size: 16),
                label: const Text('Iniciar Preparación'),
                style: FilledButton.styleFrom(backgroundColor: AppColors.cobalt),
              ),
            )
          else if (order.estado == 'PREPARANDO')
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => _confirmUpdateOrderStatus(
                  order.idPedido,
                  'LISTO_PARA_RETIRO',
                  '¿Marcar el Pedido #${order.idPedido} como LISTO para que el cliente lo retire?',
                ),
                icon: const Icon(Icons.check_circle_outline_rounded, size: 16),
                label: const Text('Marcar Listo para Retiro'),
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFFD97706)),
              ),
            )
          else if (order.estado == 'LISTO_PARA_RETIRO')
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => _confirmUpdateOrderStatus(
                  order.idPedido,
                  'RETIRADO',
                  '¿Confirmar la ENTREGA del Pedido #${order.idPedido} al cliente en sucursal?',
                ),
                icon: const Icon(Icons.handshake_rounded, size: 18),
                label: const Text('Confirmar Entrega al Cliente'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.success,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            )
          else if (order.estado == 'RETIRADO')
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle_rounded, color: AppColors.success, size: 18),
                  SizedBox(width: 6),
                  Text(
                    'Entregado al cliente con éxito',
                    style: TextStyle(
                      color: AppColors.success,
                      fontWeight: FontWeight.w700,
                      fontSize: 12.5,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildOrderStatusBadge(String estado) {
    Color bg;
    Color fg;
    String label = estado.replaceAll('_', ' ');

    switch (estado) {
      case 'PENDIENTE':
        bg = AppColors.cobaltLight;
        fg = AppColors.cobaltDark;
        label = 'PAGADO / PENDIENTE';
        break;
      case 'PREPARANDO':
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFF92400E);
        label = 'PREPARANDO';
        break;
      case 'LISTO_PARA_RETIRO':
        bg = const Color(0xFFFDE68A);
        fg = const Color(0xFFB45309);
        label = 'LISTO PARA RETIRO';
        break;
      case 'RETIRADO':
        bg = AppColors.success.withValues(alpha: 0.14);
        fg = AppColors.success;
        label = 'RETIRADO / ENTREGADO';
        break;
      case 'CANCELADO':
        bg = AppColors.danger.withValues(alpha: 0.12);
        fg = AppColors.danger;
        label = 'CANCELADO';
        break;
      default:
        bg = AppColors.muted;
        fg = AppColors.inkSoft;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  void _confirmUpdateOrderStatus(
    int orderId,
    String newStatus,
    String confirmMessage,
  ) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Pedido #$orderId'),
        content: Text(confirmMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(dialogCtx);
              final messenger = ScaffoldMessenger.of(context);
              final ok = await ref
                  .read(adminOperationsNotifierProvider.notifier)
                  .updateOrderStatus(orderId, newStatus);
              if (mounted) {
                messenger.showSnackBar(
                  SnackBar(
                    content: Text(
                      ok
                          ? 'Pedido #$orderId actualizado correctamente.'
                          : 'No se pudo actualizar el estado del pedido.',
                    ),
                    backgroundColor: ok ? AppColors.success : AppColors.danger,
                  ),
                );
              }
            },
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
  }
}
