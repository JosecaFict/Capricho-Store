import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:flutter/material.dart';

class BrandWordmark extends StatelessWidget {
  const BrandWordmark({
    this.compact = false,
    this.white = false,
    super.key,
  });

  final bool compact;
  final bool white;

  @override
  Widget build(BuildContext context) {
    final assetPath = white
        ? 'assets/images/logo-capricho-white.png'
        : 'assets/images/logo-capricho.png';
    final targetHeight = compact ? 34.0 : 78.0;

    return Semantics(
      header: true,
      label: 'Capricho Store',
      child: Image.asset(
        assetPath,
        height: targetHeight,
        fit: BoxFit.contain,
        alignment: Alignment.centerLeft,
        errorBuilder: (context, error, stackTrace) => _fallbackWordmark(),
      ),
    );
  }

  Widget _fallbackWordmark() => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'CAPRICHO',
        style: TextStyle(
          color: white ? Colors.white : AppColors.ink,
          fontSize: compact ? 17 : 28,
          height: 0.92,
          fontWeight: FontWeight.w900,
          letterSpacing: compact ? -0.5 : -1.0,
        ),
      ),
      const SizedBox(height: 2),
      Text(
        'STORE',
        style: TextStyle(
          color: white ? Colors.white70 : AppColors.cobalt,
          fontSize: compact ? 8.5 : 11,
          height: 1.0,
          fontWeight: FontWeight.w800,
          letterSpacing: compact ? 2.8 : 3.8,
        ),
      ),
    ],
  );
}

