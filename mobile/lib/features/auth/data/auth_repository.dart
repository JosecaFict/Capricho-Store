import 'package:capricho_store/core/auth/token_storage.dart';
import 'package:capricho_store/core/network/api_client.dart';
import 'package:capricho_store/core/network/api_exception.dart';
import 'package:capricho_store/features/auth/domain/app_user.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.watch(dioProvider),
    ref.watch(tokenStorageProvider),
  );
});

class AuthRepository {
  AuthRepository(this._dio, this._storage);
  final Dio _dio;
  final TokenStorage _storage;

  Future<AppUser> register({
    required String names,
    required String surnames,
    required String email,
    required String password,
    String? phone,
    String? ci,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/register',
        data: {
          'nombres': names.trim(),
          'apellidos': surnames.trim(),
          'correo': email.trim().toLowerCase(),
          'password': password,
          'telefono': _optional(phone),
          'ci': _optional(ci),
        },
      );
      return AppUser.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<AppUser> login(String email, String password) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'correo': email.trim().toLowerCase(), 'password': password},
      );
      await _storage.write(response.data!['access_token'] as String);
      return await me();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<AppUser> me() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/auth/me');
      return AppUser.fromJson(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<bool> hasSession() async => (await _storage.read()) != null;
  Future<void> logout() => _storage.clear();

  Future<String> requestPasswordRecovery(String email) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/password-recovery/request',
        data: {'correo': email.trim().toLowerCase()},
      );
      return (response.data?['message'] as String?) ??
          'Código de recuperación enviado con éxito.';
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<String> verifyPasswordRecoveryCode({
    required String email,
    required String code,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/password-recovery/verify',
        data: {'correo': email.trim().toLowerCase(), 'codigo': code.trim()},
      );
      return response.data!['reset_token'] as String;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<String> resetPassword({
    required String resetToken,
    required String newPassword,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/password-recovery/reset',
        data: {'reset_token': resetToken.trim(), 'password': newPassword},
      );
      return (response.data?['message'] as String?) ??
          'Contraseña restablecida exitosamente.';
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  static String? _optional(String? value) {
    final cleaned = value?.trim();
    return cleaned == null || cleaned.isEmpty ? null : cleaned;
  }
}
