import 'dart:async';

import 'package:capricho_store/core/auth/token_storage.dart';
import 'package:capricho_store/core/config/environment.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

/// Stream de eventos de expiración de sesión (401 en endpoints protegidos)
final sessionExpiredEventProvider = StreamController<void>.broadcast();

final dioProvider = Provider<Dio>((ref) {
  final storage = ref.watch(tokenStorageProvider);
  final dio = Dio(
    BaseOptions(
      baseUrl: Environment.apiBaseUrl,
      connectTimeout: const Duration(seconds: 12),
      receiveTimeout: const Duration(seconds: 15),
      headers: const {'Accept': 'application/json'},
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storage.read();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          final path = error.requestOptions.path;
          // No disparar expiración si el 401 proviene de login o registro
          if (!path.contains('/auth/login') &&
              !path.contains('/auth/register')) {
            await storage.clear();
            sessionExpiredEventProvider.add(null);
          }
        }
        handler.next(error);
      },
    ),
  );

  return dio;
});
