import 'package:capricho_store/app/router.dart';
import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CaprichoStoreApp extends ConsumerWidget {
  const CaprichoStoreApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp.router(
    title: 'Capricho Store',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    routerConfig: ref.watch(appRouterProvider),
  );
}
