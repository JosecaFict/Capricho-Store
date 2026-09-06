import 'package:capricho_store/core/auth/password_validator.dart';
import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:flutter/material.dart';

class PasswordRequirementList extends StatelessWidget {
  const PasswordRequirementList({
    required this.validation,
    this.showConfirmation = true,
    super.key,
  });

  final PasswordValidationResult validation;
  final bool showConfirmation;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.muted,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Requisitos de contraseña:',
            style: Theme.of(context).textTheme.labelLarge
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          _RequirementItem(
            met: validation.hasMinLength && validation.hasMaxLength,
            label: 'Mínimo 8 caracteres (máximo 128)',
          ),
          _RequirementItem(
            met: validation.hasUppercase,
            label: 'Al menos una letra mayúscula (A-Z)',
          ),
          _RequirementItem(
            met: validation.hasLowercase,
            label: 'Al menos una letra minúscula (a-z)',
          ),
          _RequirementItem(
            met: validation.hasDigit,
            label: 'Al menos un número (0-9)',
          ),
          _RequirementItem(
            met: validation.hasSpecialChar,
            label: 'Al menos un carácter especial (ej. !@#\$%*)',
          ),
          if (showConfirmation)
            _RequirementItem(
              met: validation.matchesConfirmation,
              label: 'Las contraseñas coinciden',
            ),
        ],
      ),
    );
  }
}

class _RequirementItem extends StatelessWidget {
  const _RequirementItem({required this.met, required this.label});

  final bool met;
  final String label;

  @override
  Widget build(BuildContext context) {
    final color = met ? const Color(0xFF0F766E) : AppColors.inkSoft;
    final icon = met
        ? Icons.check_circle_rounded
        : Icons.radio_button_unchecked_rounded;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                color: color,
                fontWeight: met ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
