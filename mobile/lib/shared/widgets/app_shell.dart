import 'package:capricho_store/app/navigation_memory.dart';
import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class AppShell extends StatelessWidget {
  const AppShell({required this.location, required this.child, super.key});
  final String location;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    NavigationMemory.rememberStore(location);
    final selectedIndex = location.startsWith('/cuenta')
        ? 2
        : (location.startsWith('/catalogo') ? 1 : 0);

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.line, width: 1)),
        ),
        child: NavigationBar(
          selectedIndex: selectedIndex,
          onDestinationSelected: (index) {
            switch (index) {
              case 0:
                context.go('/inicio');
                break;
              case 1:
                context.go('/catalogo');
                break;
              case 2:
                context.go('/cuenta');
                break;
            }
          },
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home_rounded),
              label: 'Inicio',
            ),
            NavigationDestination(
              icon: Icon(Icons.grid_view_outlined),
              selectedIcon: Icon(Icons.grid_view_rounded),
              label: 'Catálogo',
            ),
            NavigationDestination(
              icon: Icon(Icons.person_outline_rounded),
              selectedIcon: Icon(Icons.person_rounded),
              label: 'Mi cuenta',
            ),
          ],
        ),
      ),
    );
  }
}
