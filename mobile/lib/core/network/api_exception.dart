import 'package:dio/dio.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  factory ApiException.fromDio(DioException error) {
    final status = error.response?.statusCode;
    final data = error.response?.data;
    final detail = data is Map<String, dynamic> ? data['detail'] : null;
    if (detail is String && detail.isNotEmpty) {
      return ApiException(detail, statusCode: status);
    }
    return switch (status) {
      401 => const ApiException(
        'El correo o la contraseña no son correctos.',
        statusCode: 401,
      ),
      403 => const ApiException(
        'No tienes permiso para realizar esta acción.',
        statusCode: 403,
      ),
      409 => const ApiException(
        'Este correo ya está registrado.',
        statusCode: 409,
      ),
      422 => const ApiException(
        'Revisa los datos ingresados.',
        statusCode: 422,
      ),
      _ when error.type == DioExceptionType.connectionError =>
        const ApiException('No pudimos conectar con Capricho Store.'),
      _ => ApiException(
        'Ocurrió un problema. Inténtalo nuevamente.',
        statusCode: status,
      ),
    };
  }

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}
