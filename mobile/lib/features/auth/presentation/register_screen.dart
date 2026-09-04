import 'package:capricho_store/features/auth/presentation/auth_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final key = GlobalKey<FormState>();
  final names = TextEditingController();
  final surnames = TextEditingController();
  final email = TextEditingController();
  final phone = TextEditingController();
  final ci = TextEditingController();
  final password = TextEditingController();

  @override
  void dispose() {
    for (final controller in [names, surnames, email, phone, ci, password]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    FocusScope.of(context).unfocus();
    if (!key.currentState!.validate()) return;
    final success = await ref
        .read(authControllerProvider.notifier)
        .register(
          names: names.text,
          surnames: surnames.text,
          email: email.text,
          phone: phone.text,
          ci: ci.text,
          password: password.text,
        );
    if (success && mounted) context.go('/cuenta');
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authControllerProvider);
    InputDecoration decoration(String label, IconData icon) =>
        InputDecoration(labelText: label, prefixIcon: Icon(icon));
    return Scaffold(
      appBar: AppBar(title: const Text('Crear cuenta')),
      body: SafeArea(
        child: Form(
          key: key,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              Text(
                'Tu espacio Capricho',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              const Text(
                'Regístrate como cliente. Los campos de teléfono y CI son opcionales.',
              ),
              const SizedBox(height: 24),
              TextFormField(
                controller: names,
                textCapitalization: TextCapitalization.words,
                decoration: decoration('Nombres', Icons.person_outline),
                validator: _required,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: surnames,
                textCapitalization: TextCapitalization.words,
                decoration: decoration('Apellidos', Icons.person_outline),
                validator: _required,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: email,
                keyboardType: TextInputType.emailAddress,
                decoration: decoration('Correo', Icons.mail_outline),
                validator: (value) => value != null && value.contains('@')
                    ? null
                    : 'Ingresa un correo válido.',
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: phone,
                keyboardType: TextInputType.phone,
                decoration: decoration(
                  'Teléfono (opcional)',
                  Icons.phone_outlined,
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: ci,
                keyboardType: TextInputType.number,
                decoration: decoration('CI (opcional)', Icons.badge_outlined),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: password,
                obscureText: true,
                decoration: decoration('Contraseña', Icons.lock_outline),
                validator: (value) => (value?.length ?? 0) >= 8
                    ? null
                    : 'Usa al menos 8 caracteres.',
              ),
              if (state.error != null) ...[
                const SizedBox(height: 12),
                Text(
                  state.error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: 22),
              FilledButton(
                onPressed: state.loading ? null : submit,
                child: Text(state.loading ? 'Creando cuenta…' : 'Crear cuenta'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String? _required(String? value) => value == null || value.trim().isEmpty
      ? 'Este campo es obligatorio.'
      : null;
}
