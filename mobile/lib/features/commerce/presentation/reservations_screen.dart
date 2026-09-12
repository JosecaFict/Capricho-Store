import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/commerce/domain/commerce_models.dart';
import 'package:capricho_store/features/commerce/presentation/commerce_controller.dart';
import 'package:capricho_store/shared/widgets/adaptive/adaptive_dialogs.dart';
import 'package:capricho_store/shared/widgets/adaptive/adaptive_image.dart';
import 'package:capricho_store/shared/widgets/message_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ReservationsScreen extends ConsumerWidget {
  const ReservationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reservationsAsync = ref.watch(reservationsProvider);

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Mis Reservas de Prendas'),
          shape: const Border(
            bottom: BorderSide(color: AppColors.line, width: 1),
          ),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Activas'),
              Tab(text: 'Historial'),
            ],
          ),
          actions: [
            IconButton(
              tooltip: 'Actualizar',
              icon: const Icon(Icons.refresh_rounded),
              onPressed: () => ref.read(reservationsProvider.notifier).refresh(),
            ),
          ],
        ),
        body: reservationsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => MessageState(
            title: 'No pudimos cargar tus reservas',
            message: err.toString().replaceAll('ApiException: ', ''),
            onRetry: () => ref.read(reservationsProvider.notifier).refresh(),
          ),
          data: (reservations) {
            final active = reservations.where((r) => r.isCancellable).toList();
            final past = reservations.where((r) => !r.isCancellable).toList();

            return TabBarView(
              children: [
                _buildReservationsList(context, ref, active, isActive: true),
                _buildReservationsList(context, ref, past, isActive: false),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildReservationsList(
    BuildContext context,
    WidgetRef ref,
    List<Reservation> list, {
    required bool isActive,
  }) {
    if (list.isEmpty) {
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
                  Icons.event_busy_rounded,
                  size: 48,
                  color: AppColors.inkSoft,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                isActive
                    ? 'No tienes reservas activas'
                    : 'Aún no tienes historial de reservas',
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                isActive
                    ? 'Aparta prendas exclusivas desde el catálogo para probártelas en tienda.'
                    : 'Las reservas finalizadas, expiradas o canceladas aparecerán aquí.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: AppColors.inkSoft),
              ),
              if (isActive) ...[
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: () => context.go('/catalogo'),
                  icon: const Icon(Icons.checkroom_rounded),
                  label: const Text('Ir al catálogo'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.cobalt,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(reservationsProvider.notifier).refresh(),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: list.length,
        separatorBuilder: (_, _) => const SizedBox(height: 14),
        itemBuilder: (ctx, idx) => _buildReservationCard(ctx, ref, list[idx]),
      ),
    );
  }

  Widget _buildReservationCard(
    BuildContext context,
    WidgetRef ref,
    Reservation reservation,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Cabecera: ID y Estado
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Reserva #${reservation.idReserva}',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                  color: AppColors.ink,
                ),
              ),
              _buildStateChip(reservation.estado),
            ],
          ),
          const SizedBox(height: 12),

          // Sucursal y cita
          Row(
            children: [
              const Icon(Icons.store_mall_directory_rounded,
                  size: 16, color: AppColors.cobalt),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  reservation.sucursal,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13.5,
                    color: AppColors.ink,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.calendar_month_rounded,
                  size: 16, color: AppColors.inkSoft),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Cita: ${reservation.formattedFechaCita}',
                  style: const TextStyle(fontSize: 12.5, color: AppColors.inkSoft),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.timer_outlined, size: 16, color: AppColors.inkSoft),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Expira: ${reservation.formattedFechaExpiracion}',
                  style: const TextStyle(fontSize: 12.5, color: AppColors.inkSoft),
                ),
              ),
            ],
          ),
          const Divider(height: 20),

          // Prendas reservadas
          ...reservation.items.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: SizedBox(
                        width: 44,
                        height: 44,
                        child: AdaptiveImage(
                          imageUrl: item.imagenUrl,
                          aspectRatio: 1,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
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
                            'Talla: ${item.talla}  ·  Color: ${item.color}  ·  ${item.cantidad} un.',
                            style: const TextStyle(
                              fontSize: 11.5,
                              color: AppColors.inkSoft,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      item.formattedPrice,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: AppColors.cobaltDark,
                      ),
                    ),
                  ],
                ),
              )),

          if (reservation.isCancellable) ...[
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () => _confirmCancelReservation(context, ref, reservation),
                icon: const Icon(Icons.cancel_outlined,
                    size: 16, color: AppColors.danger),
                label: const Text(
                  'Cancelar reserva',
                  style: TextStyle(
                    color: AppColors.danger,
                    fontWeight: FontWeight.w700,
                    fontSize: 12.5,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStateChip(String estado) {
    Color bg;
    Color fg;

    switch (estado) {
      case 'PENDIENTE':
      case 'CONFIRMADA':
      case 'LISTA':
        bg = AppColors.cobaltLight;
        fg = AppColors.cobaltDark;
        break;
      case 'CONVERTIDA':
        bg = AppColors.success.withValues(alpha: 0.12);
        fg = AppColors.success;
        break;
      case 'CANCELADA':
      case 'EXPIRADA':
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
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        estado,
        style: TextStyle(
          color: fg,
          fontSize: 11.5,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Future<void> _confirmCancelReservation(
    BuildContext context,
    WidgetRef ref,
    Reservation reservation,
  ) async {
    final confirm = await AdaptiveDialogs.showConfirmation(
      context: context,
      title: 'Cancelar reserva',
      message:
          '¿Deseas cancelar la reserva #${reservation.idReserva}? Las prendas se liberarán para otros clientes.',
      confirmText: 'Sí, cancelar reserva',
      cancelText: 'Volver',
      isDestructive: true,
    );

    if (confirm == true) {
      HapticFeedback.mediumImpact();
      try {
        await ref
            .read(reservationsProvider.notifier)
            .cancelReservation(reservation.idReserva);

        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Reserva cancelada exitosamente.'),
              backgroundColor: AppColors.ink,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Error: $e'),
              backgroundColor: AppColors.danger,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    }
  }
}
