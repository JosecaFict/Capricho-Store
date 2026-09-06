import 'package:capricho_store/core/auth/password_validator.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group(
    'PasswordValidator - Pruebas unitarias de requisitos de contraseña',
    () {
      test('Rechaza contraseñas con menos de 8 caracteres', () {
        final res = PasswordValidator.validate(
          'Ab1!xyz',
          confirmation: 'Ab1!xyz',
        );
        expect(res.hasMinLength, isFalse);
        expect(res.isValid, isFalse);
      });

      test('Acepta contraseñas con 8 o más caracteres', () {
        final res = PasswordValidator.validate(
          'Abcdef1!',
          confirmation: 'Abcdef1!',
        );
        expect(res.hasMinLength, isTrue);
        expect(res.hasMaxLength, isTrue);
      });

      test('Valida presencia de mayúscula', () {
        final sinMayuscula = PasswordValidator.validate(
          'abcdef1!',
          confirmation: 'abcdef1!',
        );
        expect(sinMayuscula.hasUppercase, isFalse);
        expect(sinMayuscula.isValid, isFalse);

        final conMayuscula = PasswordValidator.validate(
          'Abcdef1!',
          confirmation: 'Abcdef1!',
        );
        expect(conMayuscula.hasUppercase, isTrue);
      });

      test('Valida presencia de minúscula', () {
        final sinMinuscula = PasswordValidator.validate(
          'ABCDEF1!',
          confirmation: 'ABCDEF1!',
        );
        expect(sinMinuscula.hasLowercase, isFalse);
        expect(sinMinuscula.isValid, isFalse);

        final conMinuscula = PasswordValidator.validate(
          'Abcdef1!',
          confirmation: 'Abcdef1!',
        );
        expect(conMinuscula.hasLowercase, isTrue);
      });

      test('Valida presencia de número', () {
        final sinNumero = PasswordValidator.validate(
          'Abcdefg!',
          confirmation: 'Abcdefg!',
        );
        expect(sinNumero.hasDigit, isFalse);
        expect(sinNumero.isValid, isFalse);

        final conNumero = PasswordValidator.validate(
          'Abcdefg1!',
          confirmation: 'Abcdefg1!',
        );
        expect(conNumero.hasDigit, isTrue);
      });

      test(
        'Valida presencia de carácter especial (no alfanumérico y no espacio)',
        () {
          final sinEspecial = PasswordValidator.validate(
            'Abcdefg1',
            confirmation: 'Abcdefg1',
          );
          expect(sinEspecial.hasSpecialChar, isFalse);
          expect(sinEspecial.isValid, isFalse);

          final conEspacio = PasswordValidator.validate(
            'Abcdefg1 ',
            confirmation: 'Abcdefg1 ',
          );
          expect(conEspacio.hasSpecialChar, isFalse);

          final conEspecial = PasswordValidator.validate(
            'Abcdefg1@',
            confirmation: 'Abcdefg1@',
          );
          expect(conEspecial.hasSpecialChar, isTrue);
          expect(conEspecial.isValid, isTrue);
        },
      );

      test('Valida coincidencia exacta de confirmación', () {
        final noCoincide = PasswordValidator.validate(
          'Password123!',
          confirmation: 'Password123?',
        );
        expect(noCoincide.matchesConfirmation, isFalse);
        expect(noCoincide.isValid, isFalse);

        final coincide = PasswordValidator.validate(
          'Password123!',
          confirmation: 'Password123!',
        );
        expect(coincide.matchesConfirmation, isTrue);
        expect(coincide.isValid, isTrue);
      });

      test('validateForBackend devuelve null para contraseñas válidas y mensaje para inválidas', () {
        expect(PasswordValidator.validateForBackend('Pass123!'), isNull);
        expect(
          PasswordValidator.validateForBackend('short'),
          contains('al menos 8 caracteres'),
        );
        expect(
          PasswordValidator.validateForBackend('lowercase123!'),
          contains('mayúscula'),
        );
        expect(
          PasswordValidator.validateForBackend('UPPERCASE123!'),
          contains('minúscula'),
        );
        expect(
          PasswordValidator.validateForBackend('NoNumber!'),
          contains('número'),
        );
        expect(
          PasswordValidator.validateForBackend('NoSpecial123'),
          contains('carácter especial'),
        );
      });
    },
  );
}
