import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/commerce/domain/commerce_models.dart';
import 'package:capricho_store/features/commerce/presentation/commerce_controller.dart';
import 'package:capricho_store/shared/widgets/message_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(ordersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis Pedidos'),
        shape: const Border(
          bottom: BorderSide(color: AppColors.line, width: 1),
        ),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(ordersProvider.notifier).refresh(),
          ),
        ],
      ),
      body: ordersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => MessageState(
          title: 'No pudimos cargar tus pedidos',
          message: err.toString().replaceAll('ApiException: ', ''),
          onRetry: () => ref.read(ordersProvider.notifier).refresh(),
        ),
        data: (orders) {
          if (orders.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.muted,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.inventory_2_outlined,
                        size: 48,
                        color: AppColors.inkSoft,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'No tienes pedidos registrados',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Cuando realices una compra en línea con Stripe, podrás seguir el estado de preparación y despacho aquí.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: AppColors.inkSoft),
                    ),
                    const SizedBox(height: 20),
                    FilledButton.icon(
                      onPressed: () => context.go('/catalogo'),
                      icon: const Icon(Icons.shopping_bag_outlined),
                      label: const Text('Comprar ahora'),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.cobalt,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.read(ordersProvider.notifier).refresh(),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: orders.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (ctx, idx) => _buildOrderCard(ctx, orders[idx]),
            ),
          );
        },
      ),
    );
  }

  Widget _buildOrderCard(BuildContext context, Order order) {
    return InkWell(
      onTap: () {
        HapticFeedback.selectionClick();
        context.push('/pedidos/${order.idPedido}');
      },
      borderRadius: BorderRadius.circular(14),
      child: Container(
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
                    fontSize: 15,
                    color: AppColors.ink,
                  ),
                ),
                _buildStatusBadge(order.estado),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(
                  order.isDelivery
                      ? Icons.two_wheeler_rounded
                      : Icons.store_mall_directory_rounded,
                  size: 16,
                  color: AppColors.cobalt,
                ),
                const SizedBox(width: 6),
                Text(
                  order.isDelivery
                      ? 'Envío Delivery a domicilio'
                      : 'Retiro en Sucursal ${order.sucursal}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                    color: AppColors.ink,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Fecha: ${order.formattedDate}',
              style: const TextStyle(fontSize: 12, color: AppColors.inkSoft),
            ),
            const Divider(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${order.items.length} prenda(s)',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                    color: AppColors.inkSoft,
                  ),
                ),
                Row(
                  children: [
                    Text(
                      order.formattedTotal,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                        color: AppColors.cobaltDark,
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Icon(Icons.arrow_forward_ios_rounded,
                        size: 14, color: AppColors.inkSoft),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String estado) {
    Color bg;
    Color fg;

    switch (estado) {
      case 'PENDIENTE':
      case 'PREPARANDO':
        bg = AppColors.cobaltLight;
        fg = AppColors.cobaltDark;
        break;
      case 'LISTO_PARA_RETIRO':
      case 'LISTO_PARA_ENVIO':
      case 'EN_CAMINO':
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFF92400E);
        break;
      case 'ENTREGADO':
      case 'RETIRADO':
        bg = AppColors.success.withValues(alpha: 0.12);
        fg = AppColors.success;
        break;
      case 'CANCELADO':
        bg = AppColors.danger.withValues(alpha: 0.1);
        fg = AppColors.danger;
        break;
      default:
        bg = AppColors.muted;
        fg = AppColors.inkSoft;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        estado.replaceAll('_', ' '),
        style: TextStyle(
          color: fg,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
