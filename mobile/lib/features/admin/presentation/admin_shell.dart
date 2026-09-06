import 'package:capricho_store/core/theme/app_theme.dart';
import 'package:capricho_store/shared/widgets/brand_wordmark.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class AdminShell extends StatelessWidget {
  const AdminShell({required this.location, required this.child, super.key});
  final String location;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final selectedIndex = location.startsWith('/admin/perfil')
        ? 3
        : (location.startsWith('/admin/operaciones')
            ? 2
            : (location.startsWith('/admin/inventario') ? 1 : 0));

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const BrandWordmark(compact: true),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.cobalt,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                'ADMIN',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                ),
              ),
            ),
          ],
        ),
        centerTitle: false,
        actions: [
          IconButton(
            tooltip: 'Ver tienda como cliente',
            icon: const Icon(Icons.storefront_outlined),
            onPressed: () => context.go('/inicio'),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: AppColors.line, height: 1),
        ),
      ),
      body: child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(
            top: BorderSide(color: AppColors.line, width: 1),
          ),
        ),
        child: NavigationBar(
          selectedIndex: selectedIndex,
          onDestinationSelected: (index) {
            switch (index) {
              case 0:
                context.go('/admin/resumen');
                break;
              case 1:
                context.go('/admin/inventario');
                break;
              case 2:
                context.go('/admin/operaciones');
                break;
              case 3:
                context.go('/admin/perfil');
                break;
            }
          },
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.dashboard_outlined),
              selectedIcon: Icon(Icons.dashboard_rounded),
              label: 'Resumen',
            ),
            NavigationDestination(
              icon: Icon(Icons.inventory_2_outlined),
              selectedIcon: Icon(Icons.inventory_2_rounded),
              label: 'Inventario',
            ),
            NavigationDestination(
              icon: Icon(Icons.swap_horiz_outlined),
              selectedIcon: Icon(Icons.swap_horiz_rounded),
              label: 'Operaciones',
            ),
            NavigationDestination(
              icon: Icon(Icons.admin_panel_settings_outlined),
              selectedIcon: Icon(Icons.admin_panel_settings_rounded),
              label: 'Admin',
            ),
          ],
        ),
      ),
    );
  }
}
