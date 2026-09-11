import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/commerce/data/commerce_api.dart';
import 'package:capricho_store/features/commerce/domain/commerce_models.dart';
import 'package:capricho_store/shared/widgets/adaptive/adaptive_image.dart';
import 'package:capricho_store/shared/widgets/message_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

final orderDetailProvider =
    FutureProvider.family<Order, int>((ref, orderId) async {
  final api = ref.watch(commerceApiProvider);
  return api.getOrder(orderId);
});

class OrderDetailScreen extends ConsumerWidget {
  final int orderId;

  const OrderDetailScreen({required this.orderId, super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orderAsync = ref.watch(orderDetailProvider(orderId));

    return Scaffold(
      appBar: AppBar(
        title: Text('Pedido #$orderId'),
        shape: const Border(
          bottom: BorderSide(color: AppColors.line, width: 1),
        ),
      ),
      body: orderAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => MessageState(
          title: 'No pudimos cargar el pedido',
          message: err.toString().replaceAll('ApiException: ', ''),
          onRetry: () => ref.refresh(orderDetailProvider(orderId)),
        ),
        data: (order) => _buildContent(context, order),
      ),
    );
  }

  Widget _buildContent(BuildContext context, Order order) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Línea de tiempo de Seguimiento
        _buildTrackingCard(order),
        const SizedBox(height: 16),

        // Datos de entrega
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Datos de Entrega',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14.5,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(
                    order.isDelivery
                        ? Icons.two_wheeler_rounded
                        : Icons.store_mall_directory_rounded,
                    color: AppColors.cobalt,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      order.isDelivery ? 'Delivery a domicilio' : 'Retiro en tienda física',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                order.isDelivery
                    ? 'Dirección: ${order.direccionEntrega ?? "No especificada"}'
                    : 'Sucursal: ${order.sucursal}\nDirección: ${order.direccionSucursal}',
                style: const TextStyle(fontSize: 12.5, color: AppColors.inkSoft, height: 1.3),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Detalle de prendas
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Prendas Compradas',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14.5,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 12),
              ...order.items.map((item) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: SizedBox(
                            width: 50,
                            height: 50,
                            child: AdaptiveImage(
                              imageUrl: item.imagenUrl,
                              aspectRatio: 1,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.producto,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                  color: AppColors.ink,
                                ),
                              ),
                              Text(
                                '${item.color} · ${item.talla} · Cant: ${item.cantidad}',
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  color: AppColors.inkSoft,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          item.formattedSubtotal,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 14,
                            color: AppColors.ink,
                          ),
                        ),
                      ],
                    ),
                  )),
              const Divider(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Total Pagado',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                      color: AppColors.ink,
                    ),
                  ),
                  Text(
                    order.formattedTotal,
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                      color: AppColors.cobaltDark,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        // Botón de recibo de Stripe
        if (order.receiptUrl != null && order.receiptUrl!.isNotEmpty) ...[
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: () => launchUrl(
              Uri.parse(order.receiptUrl!),
              mode: LaunchMode.externalApplication,
            ),
            icon: const Icon(Icons.receipt_long_rounded, color: AppColors.cobalt),
            label: const Text(
              'Ver recibo de pago oficial (Stripe)',
              style: TextStyle(
                color: AppColors.cobalt,
                fontWeight: FontWeight.w700,
              ),
            ),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              side: const BorderSide(color: AppColors.cobalt),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildTrackingCard(Order order) {
    final step = order.stepProgress;

    final steps = [
      {'title': 'Pago Confirmado', 'subtitle': 'Orden registrada'},
      {'title': 'En Preparación', 'subtitle': 'Empacando en sucursal'},
      {
        'title': order.isDelivery ? 'En Camino' : 'Listo para Retiro',
        'subtitle': order.isDelivery ? 'Repartidor asignado' : 'Disponible en tienda'
      },
      {'title': 'Entregado', 'subtitle': 'Completado'},
    ];

    return Container(
      padding: const EdgeInsets.all(18),
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
              const Text(
                'Seguimiento en Vivo',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                  color: AppColors.ink,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.cobaltLight,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  order.statusDisplay,
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: AppColors.cobaltDark,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Stepper Visual
          ...List.generate(steps.length, (idx) {
            final isDone = idx <= step && step != -1;
            final isCurrent = idx == step;
            final isLast = idx == steps.length - 1;

            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: isDone ? AppColors.cobalt : AppColors.muted,
                        shape: BoxShape.circle,
                        border: isCurrent
                            ? Border.all(color: AppColors.cobaltDark, width: 2.5)
                            : null,
                      ),
                      child: Center(
                        child: Icon(
                          isDone ? Icons.check : Icons.circle,
                          size: isDone ? 14 : 8,
                          color: isDone ? Colors.white : AppColors.inkSoft,
                        ),
                      ),
                    ),
                    if (!isLast)
                      Container(
                        width: 2,
                        height: 32,
                        color: idx < step ? AppColors.cobalt : AppColors.line,
                      ),
                  ],
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          steps[idx]['title']!,
                          style: TextStyle(
                            fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w600,
                            fontSize: 13.5,
                            color: isDone ? AppColors.ink : AppColors.inkSoft,
                          ),
                        ),
                        Text(
                          steps[idx]['subtitle']!,
                          style: TextStyle(fontSize: 11.5, color: AppColors.inkSoft),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          }),
        ],
      ),
    );
  }
}
