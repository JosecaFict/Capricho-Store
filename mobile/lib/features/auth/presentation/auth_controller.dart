import 'dart:async';

import 'package:capricho_store/core/network/api_client.dart';
import 'package:capricho_store/features/auth/data/auth_repository.dart';
import 'package:capricho_store/features/auth/domain/app_user.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AuthState {
  const AuthState({
    this.user,
    this.loading = false,
    this.initialized = false,
    this.error,
    this.sessionExpired = false,
  });

  final AppUser? user;
  final bool loading;
  final bool initialized;
  final String? error;
  final bool sessionExpired;

  bool get isAuthenticated => user != null;

  AuthState copyWith({
    AppUser? user,
    bool? loading,
    bool? initialized,
    String? error,
    bool? sessionExpired,
    bool clearUser = false,
    bool clearError = false,
  }) {
    return AuthState(
      user: clearUser ? null : (user ?? this.user),
      loading: loading ?? this.loading,
      initialized: initialized ?? this.initialized,
      error: clearError ? null : (error ?? this.error),
      sessionExpired: sessionExpired ?? this.sessionExpired,
    );
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

class AuthController extends Notifier<AuthState> {
  StreamSubscription<void>? _sessionSub;

  @override
  AuthState build() {
    _sessionSub?.cancel();
    _sessionSub = sessionExpiredEventProvider.stream.listen((_) {
      state = state.copyWith(
        clearUser: true,
        sessionExpired: true,
        error: 'Tu sesión ha expirado. Por favor ingresa nuevamente.',
      );
    });

    ref.onDispose(() {
      _sessionSub?.cancel();
    });

    Future.microtask(restore);
    return const AuthState();
  }

  void clearError() {
    if (state.error != null || state.sessionExpired) {
      state = state.copyWith(clearError: true, sessionExpired: false);
    }
  }

  Future<void> restore() async {
    if (!await ref.read(authRepositoryProvider).hasSession()) {
      state = const AuthState(initialized: true);
      return;
    }
    try {
      final user = await ref.read(authRepositoryProvider).me();
      state = AuthState(user: user, initialized: true);
    } catch (_) {
      await ref.read(authRepositoryProvider).logout();
      state = const AuthState(initialized: true);
    }
  }

  Future<bool> login(String email, String password) async {
    if (state.loading) return false;
    state = state.copyWith(
      loading: true,
      clearError: true,
      sessionExpired: false,
    );
    try {
      final user = await ref
          .read(authRepositoryProvider)
          .login(email, password);
      state = AuthState(user: user, initialized: true);
      return true;
    } catch (error) {
      state = state.copyWith(
        loading: false,
        initialized: true,
        error: error.toString(),
      );
      return false;
    }
  }

  Future<bool> register({
    required String names,
    required String surnames,
    required String email,
    required String password,
    String? phone,
    String? ci,
  }) async {
    if (state.loading) return false;
    state = state.copyWith(
      loading: true,
      clearError: true,
      sessionExpired: false,
    );
    try {
      await ref
          .read(authRepositoryProvider)
          .register(
            names: names,
            surnames: surnames,
            email: email,
            password: password,
            phone: phone,
            ci: ci,
          );
      return await login(email, password);
    } catch (error) {
      state = state.copyWith(
        loading: false,
        initialized: true,
        error: error.toString(),
      );
      return false;
    }
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AuthState(initialized: true);
  }
}
