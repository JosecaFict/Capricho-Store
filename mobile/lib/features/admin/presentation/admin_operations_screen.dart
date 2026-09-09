import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/admin/domain/admin_models.dart';
import 'package:capricho_store/features/admin/domain/operational_access.dart';
import 'package:capricho_store/features/admin/presentation/admin_controller.dart';
import 'package:capricho_store/features/auth/presentation/auth_controller.dart';
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
  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user!;
    final showPurchases = user.canViewPurchaseOrders || user.canViewReceipts;
    final showTransfers = user.canViewTransfers;
    final tabCount = (showPurchases ? 1 : 0) + (showTransfers ? 1 : 0);

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
}
