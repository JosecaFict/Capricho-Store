import 'package:flutter/material.dart';

abstract final class AppColors {
  static const canvas = Color(0xFFF7F6F3);
  static const surface = Color(0xFFFFFFFF);
  static const muted = Color(0xFFECEEF1);
  static const ink = Color(0xFF121418);
  static const inkSoft = Color(0xFF565D67);
  static const line = Color(0xFFCBD0D6);
  static const cobalt = Color(0xFF064FE8);
  static const danger = Color(0xFFB42318);
}

abstract final class AppTheme {
  static ThemeData get light {
    final scheme =
        ColorScheme.fromSeed(
          seedColor: AppColors.cobalt,
          brightness: Brightness.light,
          surface: AppColors.canvas,
        ).copyWith(
          primary: AppColors.cobalt,
          onPrimary: Colors.white,
          error: AppColors.danger,
          onSurface: AppColors.ink,
          outline: AppColors.line,
        );
    final base = ThemeData(colorScheme: scheme, useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.canvas,
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.canvas,
        foregroundColor: AppColors.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
      ),
      textTheme: base.textTheme.copyWith(
        displaySmall: base.textTheme.displaySmall?.copyWith(
          fontSize: 38,
          height: .98,
          fontWeight: FontWeight.w800,
          letterSpacing: -1.5,
        ),
        headlineMedium: base.textTheme.headlineMedium?.copyWith(
          fontWeight: FontWeight.w800,
          letterSpacing: -.8,
        ),
        titleLarge: base.textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
        ),
        bodyMedium: base.textTheme.bodyMedium?.copyWith(height: 1.45),
      ),
      inputDecorationTheme: const InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(8)),
          borderSide: BorderSide(color: AppColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(8)),
          borderSide: BorderSide(color: AppColors.line),
        ),
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      navigationBarTheme: const NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: Color(0xFFDDE7FF),
        height: 68,
      ),
      cardTheme: const CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
      ),
    );
  }
}
