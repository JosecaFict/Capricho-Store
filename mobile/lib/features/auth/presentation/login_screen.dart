import 'package:capricho_store/features/auth/presentation/auth_controller.dart';
import 'package:capricho_store/shared/widgets/brand_wordmark.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final formKey = GlobalKey<FormState>();
  final email = TextEditingController();
  final password = TextEditingController();
  bool hidden = true;

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    FocusScope.of(context).unfocus();
    if (!formKey.currentState!.validate()) return;
    final success = await ref
        .read(authControllerProvider.notifier)
        .login(email.text, password.text);
    if (success && mounted) context.go('/cuenta');
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authControllerProvider);
    return Scaffold(
      appBar: AppBar(leading: const BackButton()),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
          child: Form(
            key: formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const BrandWordmark(),
                const SizedBox(height: 38),
                Text(
                  'Vuelve a tu estilo',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Ingresa para consultar tu perfil y continuar tu experiencia.',
                ),
                const SizedBox(height: 28),
                TextFormField(
                  controller: email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  decoration: const InputDecoration(
                    labelText: 'Correo',
                    prefixIcon: Icon(Icons.mail_outline_rounded),
                  ),
                  validator: (value) => value != null && value.contains('@')
                      ? null
                      : 'Ingresa un correo válido.',
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: password,
                  obscureText: hidden,
                  autofillHints: const [AutofillHints.password],
                  decoration: InputDecoration(
                    labelText: 'Contraseña',
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    suffixIcon: IconButton(
                      tooltip: hidden
                          ? 'Mostrar contraseña'
                          : 'Ocultar contraseña',
                      onPressed: () => setState(() => hidden = !hidden),
                      icon: Icon(
                        hidden
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                      ),
                    ),
                  ),
                  validator: (value) => (value?.length ?? 0) >= 8
                      ? null
                      : 'La contraseña debe tener al menos 8 caracteres.',
                ),
                if (state.error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    state.error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
                const SizedBox(height: 22),
                FilledButton(
                  onPressed: state.loading ? null : submit,
                  child: state.loading
                      ? const SizedBox.square(
                          dimension: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Ingresar'),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => context.push('/registro'),
                  child: const Text('Crear una cuenta'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
