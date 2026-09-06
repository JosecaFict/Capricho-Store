import 'package:flutter/material.dart';

abstract final class AppColors {
  static const canvas = Color(0xFFF7F6F3);
  static const surface = Color(0xFFFFFFFF);
  static const muted = Color(0xFFECEEF1);
  static const ink = Color(0xFF121418);
  static const inkSoft = Color(0xFF565D67);
  static const line = Color(0xFFCBD0D6);
  static const cobalt = Color(0xFF064FE8);
  static const cobaltDark = Color(0xFF0039B8);
  static const danger = Color(0xFFB42318);
  static const warning = Color(0xFF7A4B00);
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
          surfaceContainerHighest: AppColors.muted,
        );
    final base = ThemeData(
      colorScheme: scheme,
      useMaterial3: true,
      fontFamily: 'Segoe UI',
    );
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.canvas,
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.canvas,
        foregroundColor: AppColors.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
      ),
      textTheme: base.textTheme.copyWith(
        displaySmall: base.textTheme.displaySmall?.copyWith(
          fontSize: 34,
          height: 1.02,
          fontWeight: FontWeight.w800,
          letterSpacing: -1.2,
          color: AppColors.ink,
        ),
        headlineMedium: base.textTheme.headlineMedium?.copyWith(
          fontSize: 24,
          height: 1.05,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.8,
          color: AppColors.ink,
        ),
        titleLarge: base.textTheme.titleLarge?.copyWith(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
          color: AppColors.ink,
        ),
        titleMedium: base.textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w700,
          color: AppColors.ink,
        ),
        bodyLarge: base.textTheme.bodyLarge?.copyWith(
          color: AppColors.ink,
          height: 1.5,
        ),
        bodyMedium: base.textTheme.bodyMedium?.copyWith(
          color: AppColors.inkSoft,
          height: 1.5,
        ),
        labelLarge: base.textTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
        labelSmall: base.textTheme.labelSmall?.copyWith(
          fontWeight: FontWeight.w700,
          letterSpacing: 1.2,
          color: AppColors.inkSoft,
        ),
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
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(8)),
          borderSide: BorderSide(color: AppColors.cobalt, width: 2),
        ),
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 48),
          backgroundColor: AppColors.cobalt,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(48, 48),
          foregroundColor: AppColors.ink,
          side: const BorderSide(color: AppColors.line),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
      ),
      navigationBarTheme: const NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: Color(0xFFE3EDFF),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        height: 68,
      ),
      cardTheme: const CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(12)),
          side: BorderSide(color: AppColors.line),
        ),
      ),
    );
  }
}
