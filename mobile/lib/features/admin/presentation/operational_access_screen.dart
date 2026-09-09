import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/auth/presentation/auth_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class OperationalAccessScreen extends ConsumerWidget {
  const OperationalAccessScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final inactive =
        user != null && user.status.trim().toUpperCase() != 'ACTIVO';

    return Scaffold(
      appBar: AppBar(title: const Text('Acceso al panel')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.lock_outline_rounded,
                    size: 52,
                    color: AppColors.cobalt,
                  ),
                  const SizedBox(height: 20),
                  Text(
                    inactive ? 'Cuenta sin acceso' : 'Acceso no autorizado',
                    style: Theme.of(context).textTheme.headlineMedium,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    inactive
                        ? 'Tu cuenta no está activa. Comunícate con la persona administradora antes de volver a intentarlo.'
                        : 'Tu cuenta está conectada, pero no tiene permiso para abrir esta sección del panel operativo.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: () => context.go('/inicio'),
                    icon: const Icon(Icons.storefront_outlined),
                    label: const Text('Volver a la tienda'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
