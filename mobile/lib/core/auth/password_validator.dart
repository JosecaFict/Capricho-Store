/// Validaciones de contraseña compatibles con el backend FastAPI (backend/app/core/security.py)
class PasswordValidationResult {
  const PasswordValidationResult({
    required this.hasMinLength,
    required this.hasMaxLength,
    required this.hasUppercase,
    required this.hasLowercase,
    required this.hasDigit,
    required this.hasSpecialChar,
    required this.matchesConfirmation,
  });

  final bool hasMinLength;
  final bool hasMaxLength;
  final bool hasUppercase;
  final bool hasLowercase;
  final bool hasDigit;
  final bool hasSpecialChar;
  final bool matchesConfirmation;

  bool get isValid =>
      hasMinLength &&
      hasMaxLength &&
      hasUppercase &&
      hasLowercase &&
      hasDigit &&
      hasSpecialChar &&
      matchesConfirmation;
}

abstract final class PasswordValidator {
  static const int minLength = 8;
  static const int maxLength = 128;

  static bool hasMinLength(String password) => password.length >= minLength;

  static bool hasMaxLength(String password) => password.length <= maxLength;

  static bool hasUppercase(String password) {
    for (var i = 0; i < password.length; i++) {
      final char = password[i];
      if (char != char.toLowerCase() && char == char.toUpperCase()) {
        return true;
      }
    }
    return false;
  }

  static bool hasLowercase(String password) {
    for (var i = 0; i < password.length; i++) {
      final char = password[i];
      if (char != char.toUpperCase() && char == char.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  static bool hasDigit(String password) {
    for (var i = 0; i < password.length; i++) {
      final code = password.codeUnitAt(i);
      if (code >= 48 && code <= 57) return true; // 0-9
    }
    return false;
  }

  /// Coincide con backend: `not character.isalnum() and not character.isspace()`
  static bool hasSpecialChar(String password) {
    for (var i = 0; i < password.length; i++) {
      final char = password[i];
      final isAlphaNum = RegExp(r'^[a-zA-Z0-9]$').hasMatch(char);
      final isSpace = RegExp(r'^\s$').hasMatch(char);
      if (!isAlphaNum && !isSpace) {
        return true;
      }
    }
    return false;
  }

  static bool matchesConfirmation(String password, String confirmation) =>
      password.isNotEmpty && password == confirmation;

  static PasswordValidationResult validate(
    String password, {
    String confirmation = '',
  }) {
    return PasswordValidationResult(
      hasMinLength: hasMinLength(password),
      hasMaxLength: hasMaxLength(password),
      hasUppercase: hasUppercase(password),
      hasLowercase: hasLowercase(password),
      hasDigit: hasDigit(password),
      hasSpecialChar: hasSpecialChar(password),
      matchesConfirmation: matchesConfirmation(password, confirmation),
    );
  }

  /// Retorna un mensaje de error si no es válida, o null si cumple todas las reglas.
  static String? validateForBackend(String password) {
    if (!hasMinLength(password)) {
      return 'La contraseña debe tener al menos 8 caracteres';
    }
    if (!hasMaxLength(password)) {
      return 'La contraseña no puede superar 128 caracteres';
    }
    if (!hasUppercase(password)) {
      return 'La contraseña debe incluir una letra mayúscula';
    }
    if (!hasLowercase(password)) {
      return 'La contraseña debe incluir una letra minúscula';
    }
    if (!hasDigit(password)) {
      return 'La contraseña debe incluir un número';
    }
    if (!hasSpecialChar(password)) {
      return 'La contraseña debe incluir un carácter especial';
    }
    return null;
  }
}
