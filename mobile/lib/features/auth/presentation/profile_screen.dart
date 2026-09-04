import 'package:capricho_store/features/auth/presentation/auth_controller.dart';
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
      return const Center(child: CircularProgressIndicator());
    }
    final user = state.user;
    if (user == null) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const BrandWordmark(compact: true),
              const Spacer(),
              Icon(
                Icons.person_outline_rounded,
                size: 54,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 20),
              Text(
                'Tu cuenta, cuando la necesites',
                style: Theme.of(context).textTheme.headlineMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              const Text(
                'Ingresa para consultar tus datos de cliente.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => context.push('/login'),
                child: const Text('Ingresar'),
              ),
              TextButton(
                onPressed: () => context.push('/registro'),
                child: const Text('Crear cuenta'),
              ),
              const Spacer(),
            ],
          ),
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 48, 20, 24),
      children: [
        const BrandWordmark(compact: true),
        const SizedBox(height: 34),
        CircleAvatar(
          radius: 34,
          child: Text(
            user.names.characters.first.toUpperCase(),
            style: Theme.of(context).textTheme.headlineMedium,
          ),
        ),
        const SizedBox(height: 18),
        Text(
          user.fullName,
          style: Theme.of(context).textTheme.headlineMedium,
          textAlign: TextAlign.center,
        ),
        Text(user.email, textAlign: TextAlign.center),
        const SizedBox(height: 30),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              children: [
                _Info(label: 'Estado', value: user.status),
                _Info(label: 'Teléfono', value: user.phone ?? 'No registrado'),
                _Info(
                  label: 'CI',
                  value: user.ci ?? 'No registrado',
                  last: true,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),
        OutlinedButton.icon(
          onPressed: () async {
            await ref.read(authControllerProvider.notifier).logout();
          },
          icon: const Icon(Icons.logout_rounded),
          label: const Text('Cerrar sesión'),
        ),
      ],
    );
  }
}

class _Info extends StatelessWidget {
  const _Info({required this.label, required this.value, this.last = false});
  final String label;
  final String value;
  final bool last;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: last ? 0 : 16),
    child: Row(
      children: [
        Text(label),
        const Spacer(),
        Flexible(
          child: Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w700),
            textAlign: TextAlign.end,
          ),
        ),
      ],
    ),
  );
}
