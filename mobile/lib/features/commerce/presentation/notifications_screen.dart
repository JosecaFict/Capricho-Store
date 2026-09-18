import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/commerce/domain/commerce_models.dart';
import 'package:capricho_store/features/commerce/presentation/commerce_controller.dart';
import 'package:capricho_store/shared/widgets/message_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);
    final unreadCount = ref.watch(unreadNotificationsCountProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          tooltip: 'Volver',
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/cuenta');
            }
          },
        ),
        title: const Text('Notificaciones'),
        shape: const Border(
          bottom: BorderSide(color: AppColors.line, width: 1),
        ),
        actions: [
          if (unreadCount > 0)
            IconButton(
              tooltip: 'Marcar todas como leídas',
              icon: const Icon(Icons.done_all_rounded, color: AppColors.cobalt),
              onPressed: () =>
                  ref.read(notificationsProvider.notifier).markAllAsRead(),
            ),
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
                      decoration: const BoxDecoration(
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
                  _buildNotificationCard(context, ref, notifications[idx]),
            ),
          );
        },
      ),
    );
  }

  Widget _buildNotificationCard(
    BuildContext context,
    WidgetRef ref,
    CustomerNotification item,
  ) {
    IconData icon;
    Color iconColor;

    if (item.tipo.contains('PEDIDO') || item.tipo.contains('VENTA')) {
      icon = Icons.local_shipping_outlined;
      iconColor = AppColors.cobalt;
    } else if (item.tipo.contains('RESERVA')) {
      icon = Icons.event_available_outlined;
      iconColor = AppColors.warning;
    } else if (item.tipo.contains('STOCK')) {
      icon = Icons.warning_amber_rounded;
      iconColor = const Color(0xFFEF4444);
    } else {
      icon = Icons.notifications_active_outlined;
      iconColor = AppColors.inkSoft;
    }

    return Material(
      color: item.isUnread
          ? AppColors.surface
          : AppColors.surface.withValues(alpha: 0.6),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          if (item.isUnread) {
            ref
                .read(notificationsProvider.notifier)
                .markAsRead(item.idNotificacion);
          }
          final route = item.targetRoute;
          if (route.isNotEmpty && route != '/notificaciones') {
            context.push(route);
          }
        },
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: item.isUnread
                  ? AppColors.cobalt.withValues(alpha: 0.35)
                  : AppColors.line,
              width: item.isUnread ? 1.5 : 1,
            ),
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
                    Row(
                      children: [
                        if (item.titulo != null && item.titulo!.isNotEmpty) ...[
                          Expanded(
                            child: Text(
                              item.titulo!,
                              style: TextStyle(
                                fontWeight: item.isUnread
                                    ? FontWeight.w900
                                    : FontWeight.w700,
                                fontSize: 13.5,
                                color: AppColors.ink,
                              ),
                            ),
                          ),
                        ],
                        if (item.isUnread) ...[
                          const SizedBox(width: 6),
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: AppColors.cobalt,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      item.contenido,
                      style: TextStyle(
                        fontSize: 12.5,
                        color:
                            item.isUnread ? AppColors.ink : AppColors.inkSoft,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          item.formattedDate,
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.inkSoft,
                          ),
                        ),
                        if (item.targetRoute != '/notificaciones')
                          const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Ver detalle',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.cobalt,
                                ),
                              ),
                              SizedBox(width: 2),
                              Icon(
                                Icons.chevron_right_rounded,
                                size: 14,
                                color: AppColors.cobalt,
                              ),
                            ],
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
