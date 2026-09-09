import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/auth/domain/app_user.dart';
import 'package:capricho_store/features/auth/presentation/auth_controller.dart';
import 'package:capricho_store/shared/widgets/adaptive/adaptive_dialogs.dart';
import 'package:capricho_store/shared/widgets/brand_wordmark.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(authControllerProvider);

    if (!state.initialized) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final user = state.user;

    return Scaffold(
      appBar: AppBar(
        title: const BrandWordmark(compact: true),
        centerTitle: false,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: AppColors.line, height: 1),
        ),
      ),
      body: user == null
          ? _buildGuestView(context)
          : _buildAuthenticatedView(context, ref, user),
    );
  }

  Widget _buildGuestView(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        children: [
          const SizedBox(height: 20),
          Center(
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer
                    .withValues(alpha: 0.35),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.person_outline_rounded,
                size: 64,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Bienvenido a tu espacio',
            style: Theme.of(context).textTheme.headlineMedium
                ?.copyWith(fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 10),
          Text(
            'Inicia sesión para gestionar tus datos de cliente, consultar tu cuenta y disfrutar de la experiencia Capricho Store.',
            style: TextStyle(color: Colors.grey.shade700, height: 1.3),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),
          FilledButton.icon(
            onPressed: () => context.push('/login'),
            icon: const Icon(Icons.login_rounded),
            label: const Text('Iniciar sesión'),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => context.push('/registro'),
            icon: const Icon(Icons.person_add_outlined),
            label: const Text('Crear cuenta nueva'),
          ),
          const SizedBox(height: 32),
          const Divider(),
          const SizedBox(height: 16),
          Text(
            '¿Qué puedes hacer en Capricho Store?',
            style: Theme.of(context).textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          _buildBenefitItem(
            context,
            icon: Icons.checkroom_outlined,
            title: 'Catálogo de prendas exclusivas',
            subtitle:
                'Explora poleras, camisas, blusas y polos por talla y color.',
          ),
          _buildBenefitItem(
            context,
            icon: Icons.straighten_outlined,
            title: 'Guía de medidas detallada',
            subtitle:
                'Consulta medidas reales de hombros, pecho, largo y manga.',
          ),
          _buildBenefitItem(
            context,
            icon: Icons.security_outlined,
            title: 'Seguridad y privacidad',
            subtitle: 'Tus credenciales y datos personales protegidos.',
          ),
        ],
      ),
    );
  }

  Widget _buildBenefitItem(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              icon,
              size: 20,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAuthenticatedView(
    BuildContext context,
    WidgetRef ref,
    AppUser user,
  ) {
    final trimmedNames = user.names.trim();
    final initials = trimmedNames.isNotEmpty
        ? trimmedNames.substring(0, 1).toUpperCase()
        : 'U';

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        // Cabecera con Avatar
        Center(
          child: Column(
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Theme.of(context).colorScheme.primary,
                      Theme.of(context).colorScheme.secondary,
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Theme.of(context).colorScheme.primary
                          .withValues(alpha: 0.25),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    initials,
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                user.fullName,
                style: Theme.of(context).textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                user.email,
                style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.muted,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.line),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          user.isStaff
                              ? Icons.shield_outlined
                              : Icons.check_circle_rounded,
                          size: 14,
                          color: user.isStaff
                              ? AppColors.cobalt
                              : const Color(0xFF10B981),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '${user.roleName.toUpperCase()} · ${user.status.toUpperCase()}',
                          style: TextStyle(
                            color: user.isStaff
                                ? AppColors.cobalt
                                : const Color(0xFF10B981),
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (user.isStaff) ...[
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.cobalt, width: 1.5),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.cobalt.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.shield_outlined,
                        color: AppColors.cobalt,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Panel Administrativo Móvil',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13.5,
                              color: AppColors.ink,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Supervisa inventario crítico, compras y transferencias.',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppColors.inkSoft,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.cobalt,
                        visualDensity: VisualDensity.compact,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      onPressed: () => context.go('/admin/resumen'),
                      child: const Text('Entrar', style: TextStyle(fontSize: 12)),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),

            // Tarjeta de información personal
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(
                        Icons.badge_outlined,
                        size: 20,
                        color: AppColors.cobalt,
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Información personal',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 13.5,
                          color: AppColors.ink,
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 24),
                  _InfoRow(label: 'Nombres', value: user.names),
                  _InfoRow(label: 'Apellidos', value: user.surnames),
                  _InfoRow(label: 'Correo', value: user.email),
                  _InfoRow(
                    label: 'Teléfono',
                    value: user.phone ?? 'No registrado',
                  ),
                  _InfoRow(label: 'CI', value: user.ci ?? 'No registrado'),
                  _InfoRow(
                    label: user.isStaff ? 'ID de Colaborador' : 'ID de Cliente',
                    value: '#${user.id}',
                    last: true,
                  ),
                ],
              ),
            ),
        const SizedBox(height: 20),

        // Accesos rápidos
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: Colors.grey.shade200),
          ),
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.grid_view_rounded),
                title: const Text('Explorar Catálogo'),
                subtitle: const Text('Ver todas las prendas disponibles'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => context.go('/catalogo'),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.home_outlined),
                title: const Text('Ir al Inicio'),
                subtitle: const Text('Novedades y categorías destacadas'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => context.go('/inicio'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Botón Cerrar Sesión
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            foregroundColor: Theme.of(context).colorScheme.error,
            side: BorderSide(color: Theme.of(context).colorScheme.error),
            padding: const EdgeInsets.symmetric(vertical: 12),
          ),
          onPressed: () => _showLogoutDialog(context, ref),
          icon: const Icon(Icons.logout_rounded),
          label: const Text('Cerrar sesión'),
        ),
      ],
    );
  }

  Future<void> _showLogoutDialog(BuildContext context, WidgetRef ref) async {
    final confirmed = await AdaptiveDialogs.showConfirmation(
      context: context,
      title: '¿Cerrar sesión?',
      message:
          'Tendrás que ingresar tus credenciales la próxima vez que desees acceder a tu cuenta.',
      confirmText: 'Cerrar sesión',
      cancelText: 'Cancelar',
      isDestructive: true,
    );

    if (confirmed == true) {
      await ref.read(authControllerProvider.notifier).logout();
    }
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value, this.last = false});

  final String label;
  final String value;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text(
              label,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }
}
