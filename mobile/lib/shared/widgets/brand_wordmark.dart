import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:flutter/material.dart';

class BrandWordmark extends StatelessWidget {
  const BrandWordmark({this.compact = false, super.key});
  final bool compact;

  @override
  Widget build(BuildContext context) => Semantics(
    header: true,
    child: Text(
      compact ? 'CAPRICHO' : 'CAPRICHO\nSTORE',
      style: TextStyle(
        color: AppColors.ink,
        fontSize: compact ? 16 : 34,
        height: .88,
        fontWeight: FontWeight.w900,
        letterSpacing: compact ? 1.2 : -1.2,
      ),
    ),
  );
}
