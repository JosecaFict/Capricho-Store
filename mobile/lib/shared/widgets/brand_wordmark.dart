import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:flutter/material.dart';

class BrandWordmark extends StatelessWidget {
  const BrandWordmark({this.compact = false, super.key});
  final bool compact;

  @override
  Widget build(BuildContext context) => Semantics(
    header: true,
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'CAPRICHO',
          style: TextStyle(
            color: AppColors.ink,
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
            color: AppColors.cobalt,
            fontSize: compact ? 8.5 : 11,
            height: 1.0,
            fontWeight: FontWeight.w800,
            letterSpacing: compact ? 2.8 : 3.8,
          ),
        ),
      ],
    ),
  );
}
