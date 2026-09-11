import 'package:capricho_store/app/navigation_memory.dart';
import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/features/commerce/presentation/commerce_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class AppShell extends ConsumerWidget {
  const AppShell({required this.location, required this.child, super.key});
  final String location;
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    NavigationMemory.rememberStore(location);
    final cartCount = ref.watch(cartItemCountProvider);

    int selectedIndex = 0;
    if (location.startsWith('/cuenta')) {
      selectedIndex = 3;
    } else if (location.startsWith('/carrito')) {
      selectedIndex = 2;
    } else if (location.startsWith('/catalogo')) {
      selectedIndex = 1;
    }

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
                context.go('/carrito');
                break;
              case 3:
                context.go('/cuenta');
                break;
            }
          },
          destinations: [
            const NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home_rounded),
              label: 'Inicio',
            ),
            const NavigationDestination(
              icon: Icon(Icons.grid_view_outlined),
              selectedIcon: Icon(Icons.grid_view_rounded),
              label: 'Catálogo',
            ),
            NavigationDestination(
              icon: Badge(
                isLabelVisible: cartCount > 0,
                label: Text('$cartCount'),
                backgroundColor: AppColors.cobalt,
                child: const Icon(Icons.shopping_bag_outlined),
              ),
              selectedIcon: Badge(
                isLabelVisible: cartCount > 0,
                label: Text('$cartCount'),
                backgroundColor: AppColors.cobalt,
                child: const Icon(Icons.shopping_bag_rounded),
              ),
              label: 'Carrito',
            ),
            const NavigationDestination(
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
