import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/admin/domain/admin_models.dart';
import 'package:capricho_store/features/admin/domain/operational_access.dart';
import 'package:capricho_store/features/admin/presentation/admin_controller.dart';
import 'package:capricho_store/features/auth/presentation/auth_controller.dart';
import 'package:capricho_store/shared/widgets/message_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncMetrics = ref.watch(adminDashboardProvider);
    final user = ref.watch(authControllerProvider).user!;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(adminDashboardProvider.future),
        color: AppColors.cobalt,
        child: asyncMetrics.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: MessageState(
                title: 'No pudimos cargar el resumen',
                message: err.toString(),
                onRetry: () => ref.refresh(adminDashboardProvider),
              ),
            ),
          ),
          data: (metrics) => ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              Text(
                'Resumen operativo',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${user.operationalContextLabel}. Solo se muestran datos autorizados para tu cuenta.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 12),

              LayoutBuilder(
                builder: (context, constraints) {
                  final cardWidth = (constraints.maxWidth - 12) / 2;
                  final cards = <Widget>[
                    if (user.canViewInventory)
                      _buildMetricCard(
                        context,
                        title: 'Stock crítico',
                        value: '${metrics.criticalStockCount}',
                        subtitle: 'Variantes con stock bajo',
                        icon: Icons.warning_amber_rounded,
                        accentColor: metrics.criticalStockCount > 0
                            ? AppColors.danger
                            : AppColors.success,
                        onTap: () => context.go('/admin/inventario'),
                      ),
                    if (user.canViewPurchaseOrders)
                      _buildMetricCard(
                        context,
                        title: 'Compras pendientes',
                        value: '${metrics.pendingOrdersCount}',
                        subtitle: 'Órdenes por recibir',
                        icon: Icons.shopping_bag_outlined,
                        accentColor: AppColors.cobalt,
                        onTap: () => context.go('/admin/operaciones'),
                      ),
                    if (user.canViewTransfers)
                      _buildMetricCard(
                        context,
                        title: 'Transferencias',
                        value: '${metrics.pendingTransfersCount}',
                        subtitle: 'Despachos en tránsito',
                        icon: Icons.swap_horiz_rounded,
                        accentColor: AppColors.warning,
                        onTap: () => context.go('/admin/operaciones'),
                      ),
                    if (user.canViewReceipts)
                      _buildMetricCard(
                        context,
                        title: 'Recepciones',
                        value: '${metrics.recentReceiptsCount}',
                        subtitle: 'Ingresos registrados',
                        icon: Icons.fact_check_outlined,
                        accentColor: AppColors.inkSoft,
                        onTap: () => context.go('/admin/operaciones'),
                      ),
                  ];
                  if (cards.isEmpty) {
                    return const MessageState(
                      title: 'Sin indicadores disponibles',
                      message: 'Tu cuenta no tiene permisos de consulta para los indicadores de este resumen.',
                    );
                  }
                  return Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: cards
                        .map((card) => SizedBox(width: cardWidth, child: card))
                        .toList(),
                  );
                },
              ),
              const SizedBox(height: 28),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Alertas',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.ink,
                      letterSpacing: -0.3,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: metrics.alerts.isNotEmpty
                          ? const Color(0xFFEF4444).withValues(alpha: 0.1)
                          : AppColors.muted,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${metrics.alerts.length} activas',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: metrics.alerts.isNotEmpty
                            ? const Color(0xFFEF4444)
                            : AppColors.inkSoft,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              if (metrics.alerts.isEmpty)
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.line),
                  ),
                  child: const Column(
                    children: [
                      Icon(
                        Icons.check_circle_outline_rounded,
                        color: Color(0xFF10B981),
                        size: 36,
                      ),
                      SizedBox(height: 10),
                      Text(
                        'Sin alertas pendientes',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: AppColors.ink,
                          fontSize: 14,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'No hay alertas en los módulos que tu cuenta puede consultar.',
                        style: TextStyle(
                          color: AppColors.inkSoft,
                          fontSize: 12,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                )
              else
                ...metrics.alerts.map(
                  (alert) => _buildAlertTile(context, alert),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMetricCard(
    BuildContext context, {
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color accentColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.inkSoft,
                      height: 1.2,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Icon(icon, size: 18, color: accentColor),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w900,
                color: accentColor,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(fontSize: 12, color: AppColors.inkSoft),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAlertTile(BuildContext context, AdminAlert alert) {
    Color badgeColor;
    IconData alertIcon;

    switch (alert.level) {
      case AdminAlertLevel.critical:
        badgeColor = const Color(0xFFEF4444);
        alertIcon = Icons.error_outline_rounded;
        break;
      case AdminAlertLevel.warning:
        badgeColor = const Color(0xFFF59E0B);
        alertIcon = Icons.warning_amber_rounded;
        break;
      case AdminAlertLevel.info:
        badgeColor = AppColors.cobalt;
        alertIcon = Icons.info_outline_rounded;
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
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(alertIcon, size: 20, color: badgeColor),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      alert.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: badgeColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        alert.category,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: badgeColor,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  alert.message,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.inkSoft,
                    height: 1.3,
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
