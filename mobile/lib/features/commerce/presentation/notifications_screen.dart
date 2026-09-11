import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/commerce/domain/commerce_models.dart';
import 'package:capricho_store/features/commerce/presentation/commerce_controller.dart';
import 'package:capricho_store/shared/widgets/message_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones'),
        shape: const Border(
          bottom: BorderSide(color: AppColors.line, width: 1),
        ),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(notificationsProvider.notifier).refresh(),
          ),
        ],
      ),
      body: notificationsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => MessageState(
          title: 'No pudimos cargar tus notificaciones',
          message: err.toString().replaceAll('ApiException: ', ''),
          onRetry: () => ref.read(notificationsProvider.notifier).refresh(),
        ),
        data: (notifications) {
          if (notifications.isEmpty) {
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
                        Icons.notifications_none_rounded,
                        size: 48,
                        color: AppColors.inkSoft,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Sin notificaciones por ahora',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Aquí te informaremos sobre el estado de tus pedidos, recordatorios de reservas y novedades.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: AppColors.inkSoft),
                    ),
                  ],
                ),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.read(notificationsProvider.notifier).refresh(),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: notifications.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (ctx, idx) =>
                  _buildNotificationCard(notifications[idx]),
            ),
          );
        },
      ),
    );
  }

  Widget _buildNotificationCard(CustomerNotification item) {
    IconData icon;
    Color iconColor;

    if (item.tipo.contains('PEDIDO') || item.tipo.contains('VENTA')) {
      icon = Icons.local_shipping_outlined;
      iconColor = AppColors.cobalt;
    } else if (item.tipo.contains('RESERVA')) {
      icon = Icons.event_available_outlined;
      iconColor = AppColors.warning;
    } else {
      icon = Icons.notifications_active_outlined;
      iconColor = AppColors.inkSoft;
    }

    return Container(
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
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (item.titulo != null && item.titulo!.isNotEmpty) ...[
                  Text(
                    item.titulo!,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13.5,
                      color: AppColors.ink,
                    ),
                  ),
                  const SizedBox(height: 2),
                ],
                Text(
                  item.contenido,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.ink,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  item.formattedDate,
                  style: const TextStyle(fontSize: 11, color: AppColors.inkSoft),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
