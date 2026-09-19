import 'dart:async';

import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/auth/presentation/auth_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fadeIn;
  late final Animation<double> _scale;
  late final Animation<double> _fadeOut;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1150),
    );

    // Entrada: fade-in suave y escala editorial de 0.94 a 1.00
    _fadeIn = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.45, curve: Curves.easeOutCubic),
      ),
    );

    _scale = Tween<double>(begin: 0.94, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.50, curve: Curves.easeOutCubic),
      ),
    );

    // Salida: fade-out sutil hacia la pantalla de inicio
    _fadeOut = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.85, 1.0, curve: Curves.easeInOutCubic),
      ),
    );

    _controller.forward();
    _handleSessionAndNavigate();
  }

  Future<void> _handleSessionAndNavigate() async {
    final authNotifier = ref.read(authControllerProvider.notifier);
    final authState = ref.read(authControllerProvider);

    // Si la sesión no ha sido restaurada aún, disparar restauración en paralelo
    Future<void> sessionFuture;
    if (authState.initialized) {
      sessionFuture = Future.value();
    } else {
      sessionFuture = authNotifier.restore();
    }

    // Esperar la duración total del splash (1.15s) y la resolución de sesión
    // con un timeout de seguridad para que la app jamás se congele si la red falla.
    await Future.wait([
      Future.delayed(const Duration(milliseconds: 1150)),
      sessionFuture.timeout(
        const Duration(milliseconds: 1500),
        onTimeout: () {
          // Timeout de red: continúa limpiamente como invitado
        },
      ),
    ]);

    if (!mounted) return;

    // Navegación limpia al inicio (reemplazando el splash del historial)
    context.go('/inicio');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: Center(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final currentOpacity = _fadeIn.value * _fadeOut.value;
            return Opacity(
              opacity: currentOpacity.clamp(0.0, 1.0),
              child: Transform.scale(
                scale: _scale.value,
                child: child,
              ),
            );
          },
          child: Semantics(
            header: true,
            label: 'Capricho Store',
            child: Image.asset(
              'assets/images/logo-capricho.png',
              width: 220,
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) => const Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'CAPRICHO',
                    style: TextStyle(
                      fontFamily: 'serif',
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 4.0,
                      color: AppColors.ink,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'STORE',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 6.0,
                      color: AppColors.inkSoft,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
