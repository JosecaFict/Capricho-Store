import 'package:capricho_store/app/router.dart';
import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:flutter/material.dart';

class CaprichoStoreApp extends StatelessWidget {
  const CaprichoStoreApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp.router(
    title: 'Capricho Store',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    routerConfig: appRouter,
  );
}
