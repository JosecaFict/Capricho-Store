import 'package:dio/dio.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  factory ApiException.fromDio(DioException error) {
    final status = error.response?.statusCode;
    final data = error.response?.data;

    // Si el backend devuelve detail como String
    if (data is Map<String, dynamic>) {
      final detail = data['detail'];
      if (detail is String && detail.trim().isNotEmpty) {
        return ApiException(detail.trim(), statusCode: status);
      }
      // Si FastAPI/Pydantic devuelve detail como List de errores
      if (detail is List && detail.isNotEmpty) {
        final messages = detail
            .map((item) {
              if (item is Map<String, dynamic> && item['msg'] is String) {
                return item['msg'] as String;
              }
              return item.toString();
            })
            .where((msg) => msg.trim().isNotEmpty)
            .toList();
        if (messages.isNotEmpty) {
          return ApiException(messages.first, statusCode: status);
        }
      }
      final message = data['message'];
      if (message is String && message.trim().isNotEmpty) {
        return ApiException(message.trim(), statusCode: status);
      }
    }

    return switch (status) {
      400 => const ApiException(
        'Solicitud inválida. Revisa los datos ingresados.',
        statusCode: 400,
      ),
      401 => const ApiException(
        'El correo o la contraseña no son correctos.',
        statusCode: 401,
      ),
      403 => const ApiException(
        'No tienes permiso para realizar esta acción.',
        statusCode: 403,
      ),
      404 => const ApiException(
        'El recurso solicitado no fue encontrado.',
        statusCode: 404,
      ),
      409 => const ApiException(
        'Este correo ya está registrado.',
        statusCode: 409,
      ),
      422 => const ApiException(
        'Los datos ingresados no cumplen el formato requerido.',
        statusCode: 422,
      ),
      429 => const ApiException(
        'Demasiados intentos. Por favor espera unos minutos.',
        statusCode: 429,
      ),
      500 || 502 || 503 || 504 => const ApiException(
        'El servicio no está disponible temporalmente. Inténtalo más tarde.',
        statusCode: 500,
      ),
      _
          when error.type == DioExceptionType.connectionTimeout ||
              error.type == DioExceptionType.sendTimeout ||
              error.type == DioExceptionType.receiveTimeout =>
        const ApiException('El servidor tardó demasiado en responder.'),
      _ when error.type == DioExceptionType.connectionError =>
        const ApiException(
          'No pudimos conectar con el servidor de Capricho Store.',
        ),
      _ => ApiException(
        'Ocurrió un problema inesperado. Inténtalo nuevamente.',
        statusCode: status,
      ),
    };
  }

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}
