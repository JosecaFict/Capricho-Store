import 'package:capricho_store/core/auth/password_validator.dart';
import 'package:capricho_store/core/network/api_exception.dart';
import 'package:capricho_store/features/auth/data/auth_repository.dart';
import 'package:capricho_store/features/auth/presentation/widgets/password_requirement_list.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

enum RecoveryStep { requestEmail, verifyCode, resetPassword, completed }

class PasswordRecoveryScreen extends ConsumerStatefulWidget {
  const PasswordRecoveryScreen({super.key});

  @override
  ConsumerState<PasswordRecoveryScreen> createState() =>
      _PasswordRecoveryScreenState();
}

class _PasswordRecoveryScreenState
    extends ConsumerState<PasswordRecoveryScreen> {
  RecoveryStep currentStep = RecoveryStep.requestEmail;

  final emailController = TextEditingController();
  final codeController = TextEditingController();
  final newPasswordController = TextEditingController();
  final confirmPasswordController = TextEditingController();

  final formKey = GlobalKey<FormState>();

  bool loading = false;
  String? errorMessage;
  String? successMessage;
  String? resetToken;

  bool hidePassword = true;
  bool hideConfirmPassword = true;

  PasswordValidationResult passwordValidation = PasswordValidator.validate(
    '',
    confirmation: '',
  );

  @override
  void initState() {
    super.initState();
    newPasswordController.addListener(_onPasswordChanged);
    confirmPasswordController.addListener(_onPasswordChanged);
  }

  void _onPasswordChanged() {
    setState(() {
      passwordValidation = PasswordValidator.validate(
        newPasswordController.text,
        confirmation: confirmPasswordController.text,
      );
    });
  }

  @override
  void dispose() {
    newPasswordController.removeListener(_onPasswordChanged);
    confirmPasswordController.removeListener(_onPasswordChanged);
    emailController.dispose();
    codeController.dispose();
    newPasswordController.dispose();
    confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleRequestCode() async {
    final email = emailController.text.trim().toLowerCase();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => errorMessage = 'Ingresa un correo electrónico válido.');
      return;
    }

    setState(() {
      loading = true;
      errorMessage = null;
    });

    try {
      final msg = await ref
          .read(authRepositoryProvider)
          .requestPasswordRecovery(email);
      setState(() {
        currentStep = RecoveryStep.verifyCode;
        successMessage = msg;
        loading = false;
      });
    } catch (e) {
      setState(() {
        errorMessage = e is ApiException ? e.message : e.toString();
        loading = false;
      });
    }
  }

  Future<void> _handleVerifyCode() async {
    final code = codeController.text.trim();
    if (code.length != 6) {
      setState(
        () => errorMessage = 'El código debe tener exactamente 6 dígitos.',
      );
      return;
    }

    setState(() {
      loading = true;
      errorMessage = null;
    });

    try {
      final token = await ref
          .read(authRepositoryProvider)
          .verifyPasswordRecoveryCode(
            email: emailController.text.trim().toLowerCase(),
            code: code,
          );
      setState(() {
        resetToken = token;
        currentStep = RecoveryStep.resetPassword;
        successMessage =
            'Código verificado con éxito. Ingresa tu nueva contraseña.';
        loading = false;
      });
    } catch (e) {
      setState(() {
        errorMessage = e is ApiException ? e.message : e.toString();
        loading = false;
      });
    }
  }

  Future<void> _handleResetPassword() async {
    if (resetToken == null) {
      setState(
        () => errorMessage =
            'Token de restablecimiento inválido. Reinicia el proceso.',
      );
      return;
    }

    if (!passwordValidation.isValid) {
      setState(
        () =>
            errorMessage = 'La contraseña no cumple con todos los requisitos.',
      );
      return;
    }

    setState(() {
      loading = true;
      errorMessage = null;
    });

    try {
      final msg = await ref
          .read(authRepositoryProvider)
          .resetPassword(
            resetToken: resetToken!,
            newPassword: newPasswordController.text,
          );
      setState(() {
        currentStep = RecoveryStep.completed;
        successMessage = msg;
        loading = false;
      });
    } catch (e) {
      setState(() {
        errorMessage = e is ApiException ? e.message : e.toString();
        loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Recuperar contraseña'),
        leading: BackButton(
          onPressed: () {
            if (currentStep == RecoveryStep.verifyCode) {
              setState(() {
                currentStep = RecoveryStep.requestEmail;
                errorMessage = null;
              });
            } else if (currentStep == RecoveryStep.resetPassword) {
              setState(() {
                currentStep = RecoveryStep.verifyCode;
                errorMessage = null;
              });
            } else {
              context.pop();
            }
          },
        ),
      ),
      body: SafeArea(
        child: GestureDetector(
          onTap: () => FocusScope.of(context).unfocus(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
            children: [
              _buildStepIndicator(),
              const SizedBox(height: 24),
              if (errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.error
                        .withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: Theme.of(context).colorScheme.error
                          .withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.error_outline_rounded,
                        color: Theme.of(context).colorScheme.error,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          errorMessage!,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
              if (successMessage != null &&
                  currentStep != RecoveryStep.completed) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.green.shade300),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.check_circle_outline,
                        color: Colors.green.shade700,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          successMessage!,
                          style: TextStyle(
                            color: Colors.green.shade900,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
              switch (currentStep) {
                RecoveryStep.requestEmail => _buildRequestEmailStep(),
                RecoveryStep.verifyCode => _buildVerifyCodeStep(),
                RecoveryStep.resetPassword => _buildResetPasswordStep(),
                RecoveryStep.completed => _buildCompletedStep(),
              },
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStepIndicator() {
    final stepIndex = switch (currentStep) {
      RecoveryStep.requestEmail => 0,
      RecoveryStep.verifyCode => 1,
      RecoveryStep.resetPassword => 2,
      RecoveryStep.completed => 3,
    };

    return Row(
      children: List.generate(3, (index) {
        final isActive = index <= stepIndex;
        return Expanded(
          child: Row(
            children: [
              Expanded(
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: isActive
                        ? Theme.of(context).colorScheme.primary
                        : Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              if (index < 2) const SizedBox(width: 6),
            ],
          ),
        );
      }),
    );
  }

  Widget _buildRequestEmailStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '¿Olvidaste tu contraseña?',
          style: Theme.of(context).textTheme.headlineSmall
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Text(
          'Ingresa el correo electrónico asociado a tu cuenta de Capricho Store. Te enviaremos un código OTP de 6 dígitos.',
          style: TextStyle(color: Colors.grey.shade700),
        ),
        const SizedBox(height: 24),
        TextFormField(
          controller: emailController,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => loading ? null : _handleRequestCode(),
          decoration: const InputDecoration(
            labelText: 'Correo electrónico',
            prefixIcon: Icon(Icons.mail_outline_rounded),
          ),
        ),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: loading ? null : _handleRequestCode,
          child: loading
              ? const SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Enviar código OTP'),
        ),
      ],
    );
  }

  Widget _buildVerifyCodeStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Ingresa el código OTP',
          style: Theme.of(context).textTheme.headlineSmall
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Text(
          'Enviamos un código de 6 dígitos a:\n${emailController.text}',
          style: TextStyle(color: Colors.grey.shade700),
        ),
        const SizedBox(height: 24),
        TextFormField(
          controller: codeController,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 28,
            letterSpacing: 8,
            fontWeight: FontWeight.bold,
          ),
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(6),
          ],
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => loading ? null : _handleVerifyCode(),
          decoration: const InputDecoration(
            labelText: 'Código de 6 dígitos',
            hintText: '000000',
            prefixIcon: Icon(Icons.pin_outlined),
          ),
        ),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: loading ? null : _handleVerifyCode,
          child: loading
              ? const SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Verificar código'),
        ),
        const SizedBox(height: 12),
        TextButton(
          onPressed: loading ? null : _handleRequestCode,
          child: const Text('¿No recibiste el código? Reenviar'),
        ),
      ],
    );
  }

  Widget _buildResetPasswordStep() {
    final canSubmit = passwordValidation.isValid;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Nueva contraseña',
          style: Theme.of(context).textTheme.headlineSmall
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Text(
          'Crea una contraseña segura que cumpla con todos los requisitos solicitados.',
          style: TextStyle(color: Colors.grey.shade700),
        ),
        const SizedBox(height: 24),
        TextFormField(
          controller: newPasswordController,
          obscureText: hidePassword,
          textInputAction: TextInputAction.next,
          decoration: InputDecoration(
            labelText: 'Nueva contraseña',
            prefixIcon: const Icon(Icons.lock_outline_rounded),
            suffixIcon: IconButton(
              tooltip: hidePassword ? 'Mostrar' : 'Ocultar',
              icon: Icon(
                hidePassword
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
              ),
              onPressed: () => setState(() => hidePassword = !hidePassword),
            ),
          ),
        ),
        const SizedBox(height: 14),
        TextFormField(
          controller: confirmPasswordController,
          obscureText: hideConfirmPassword,
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) =>
              canSubmit && !loading ? _handleResetPassword() : null,
          decoration: InputDecoration(
            labelText: 'Confirmar nueva contraseña',
            prefixIcon: const Icon(Icons.lock_reset_rounded),
            suffixIcon: IconButton(
              tooltip: hideConfirmPassword ? 'Mostrar' : 'Ocultar',
              icon: Icon(
                hideConfirmPassword
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
              ),
              onPressed: () =>
                  setState(() => hideConfirmPassword = !hideConfirmPassword),
            ),
          ),
        ),
        const SizedBox(height: 16),
        PasswordRequirementList(validation: passwordValidation),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: canSubmit && !loading ? _handleResetPassword : null,
          child: loading
              ? const SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Restablecer contraseña'),
        ),
      ],
    );
  }

  Widget _buildCompletedStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const SizedBox(height: 32),
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: Colors.green.shade100,
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.check_rounded,
            size: 48,
            color: Colors.green.shade800,
          ),
        ),
        const SizedBox(height: 24),
        Text(
          '¡Contraseña restablecida!',
          style: Theme.of(context).textTheme.headlineSmall
              ?.copyWith(fontWeight: FontWeight.bold),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 12),
        Text(
          successMessage ?? 'Tu contraseña se ha modificado correctamente. Ya puedes iniciar sesión con tus nuevas credenciales.',
          style: TextStyle(color: Colors.grey.shade700),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        FilledButton(
          onPressed: () => context.go('/login'),
          child: const Text('Iniciar sesión ahora'),
        ),
      ],
    );
  }
}
