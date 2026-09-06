import 'package:capricho_store/core/auth/password_validator.dart';
import 'package:capricho_store/features/auth/presentation/auth_controller.dart';
import 'package:capricho_store/features/auth/presentation/widgets/password_requirement_list.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final formKey = GlobalKey<FormState>();
  final names = TextEditingController();
  final surnames = TextEditingController();
  final email = TextEditingController();
  final phone = TextEditingController();
  final ci = TextEditingController();
  final password = TextEditingController();
  final confirmPassword = TextEditingController();

  bool hidePassword = true;
  bool hideConfirmPassword = true;

  PasswordValidationResult passwordValidation = const PasswordValidationResult(
    hasMinLength: false,
    hasMaxLength: true,
    hasUppercase: false,
    hasLowercase: false,
    hasDigit: false,
    hasSpecialChar: false,
    matchesConfirmation: false,
  );

  @override
  void initState() {
    super.initState();
    password.addListener(_onPasswordChanged);
    confirmPassword.addListener(_onPasswordChanged);
    names.addListener(_updateCanSubmit);
    surnames.addListener(_updateCanSubmit);
    email.addListener(_updateCanSubmit);
  }

  void _onPasswordChanged() {
    setState(() {
      passwordValidation = PasswordValidator.validate(
        password.text,
        confirmation: confirmPassword.text,
      );
    });
  }

  void _updateCanSubmit() {
    setState(() {});
  }

  bool get _isEmailValid {
    final text = email.text.trim();
    return text.contains('@') && text.contains('.') && text.length >= 5;
  }

  bool get _canSubmit {
    return names.text.trim().isNotEmpty &&
        surnames.text.trim().isNotEmpty &&
        _isEmailValid &&
        passwordValidation.isValid &&
        !ref.read(authControllerProvider).loading;
  }

  @override
  void dispose() {
    names.dispose();
    surnames.dispose();
    email.dispose();
    phone.dispose();
    ci.dispose();
    password.dispose();
    confirmPassword.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    FocusScope.of(context).unfocus();
    if (!_canSubmit) return;

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

    if (success && mounted) {
      context.go('/cuenta');
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Crear cuenta')),
      body: SafeArea(
        child: GestureDetector(
          onTap: () => FocusScope.of(context).unfocus(),
          child: Form(
            key: formKey,
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
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Nombres *',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  validator: (val) => val == null || val.trim().isEmpty
                      ? 'Este campo es obligatorio.'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: surnames,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Apellidos *',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  validator: (val) => val == null || val.trim().isEmpty
                      ? 'Este campo es obligatorio.'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: email,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Correo electrónico *',
                    prefixIcon: Icon(Icons.mail_outline),
                  ),
                  validator: (_) =>
                      _isEmailValid ? null : 'Ingresa un correo válido.',
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: phone,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Teléfono (opcional)',
                    prefixIcon: Icon(Icons.phone_outlined),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: ci,
                  keyboardType: TextInputType.text,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'CI (opcional)',
                    prefixIcon: Icon(Icons.badge_outlined),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: password,
                  obscureText: hidePassword,
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(
                    labelText: 'Contraseña *',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      tooltip: hidePassword
                          ? 'Mostrar contraseña'
                          : 'Ocultar contraseña',
                      icon: Icon(
                        hidePassword
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                      ),
                      onPressed: () =>
                          setState(() => hidePassword = !hidePassword),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: confirmPassword,
                  obscureText: hideConfirmPassword,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _canSubmit ? submit() : null,
                  decoration: InputDecoration(
                    labelText: 'Confirmar contraseña *',
                    prefixIcon: const Icon(Icons.lock_reset_outlined),
                    suffixIcon: IconButton(
                      tooltip: hideConfirmPassword
                          ? 'Mostrar confirmación'
                          : 'Ocultar confirmación',
                      icon: Icon(
                        hideConfirmPassword
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                      ),
                      onPressed: () => setState(
                        () => hideConfirmPassword = !hideConfirmPassword,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                PasswordRequirementList(validation: passwordValidation),
                if (state.error != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.error
                          .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      state.error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _canSubmit && !state.loading ? submit : null,
                  child: state.loading
                      ? const SizedBox.square(
                          dimension: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Crear cuenta'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
