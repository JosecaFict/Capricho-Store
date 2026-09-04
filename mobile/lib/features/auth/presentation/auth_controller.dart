import 'package:capricho_store/features/auth/data/auth_repository.dart';
import 'package:capricho_store/features/auth/domain/app_user.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AuthState {
  const AuthState({
    this.user,
    this.loading = false,
    this.initialized = false,
    this.error,
  });
  final AppUser? user;
  final bool loading;
  final bool initialized;
  final String? error;

  AuthState copyWith({
    AppUser? user,
    bool? loading,
    bool? initialized,
    String? error,
  }) {
    return AuthState(
      user: user ?? this.user,
      loading: loading ?? this.loading,
      initialized: initialized ?? this.initialized,
      error: error,
    );
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    Future.microtask(restore);
    return const AuthState();
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
    state = state.copyWith(loading: true);
    try {
      final user = await ref
          .read(authRepositoryProvider)
          .login(email, password);
      state = AuthState(user: user, initialized: true);
      return true;
    } catch (error) {
      state = AuthState(initialized: true, error: error.toString());
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
    state = state.copyWith(loading: true);
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
      state = AuthState(initialized: true, error: error.toString());
      return false;
    }
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AuthState(initialized: true);
  }
}
