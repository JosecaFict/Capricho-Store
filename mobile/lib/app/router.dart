import 'package:capricho_store/app/navigation_memory.dart';
import 'package:capricho_store/features/admin/presentation/admin_dashboard_screen.dart';
import 'package:capricho_store/features/admin/presentation/admin_inventory_screen.dart';
import 'package:capricho_store/features/admin/presentation/admin_operations_screen.dart';
import 'package:capricho_store/features/admin/presentation/admin_profile_screen.dart';
import 'package:capricho_store/features/admin/presentation/admin_shell.dart';
import 'package:capricho_store/features/admin/presentation/operational_access_screen.dart';
import 'package:capricho_store/features/auth/presentation/auth_controller.dart';
import 'package:capricho_store/features/auth/presentation/login_screen.dart';
import 'package:capricho_store/features/auth/presentation/password_recovery_screen.dart';
import 'package:capricho_store/features/auth/presentation/profile_screen.dart';
import 'package:capricho_store/features/auth/presentation/register_screen.dart';
import 'package:capricho_store/features/catalog/domain/catalog_models.dart';
import 'package:capricho_store/features/catalog/presentation/catalog_screen.dart';
import 'package:capricho_store/features/catalog/presentation/product_detail_screen.dart';
import 'package:capricho_store/features/fitting/presentation/virtual_fitting_screen.dart';
import 'package:capricho_store/features/commerce/presentation/addresses_screen.dart';
import 'package:capricho_store/features/commerce/presentation/cart_screen.dart';
import 'package:capricho_store/features/commerce/presentation/checkout_screen.dart';
import 'package:capricho_store/features/commerce/presentation/notifications_screen.dart';
import 'package:capricho_store/features/commerce/presentation/order_detail_screen.dart';
import 'package:capricho_store/features/commerce/presentation/orders_screen.dart';
import 'package:capricho_store/features/commerce/presentation/reservations_screen.dart';
import 'package:capricho_store/features/home/presentation/home_screen.dart';
import 'package:capricho_store/shared/widgets/app_shell.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');
final _shellNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'storeShell');
final _adminShellNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'adminShell');

/// Construye páginas nativas adaptativas:
/// - En iOS: CupertinoPage, activando el gesto físico de deslizamiento para volver atrás (Swipe-to-back) y animaciones nativas de iOS.
/// - En Android: MaterialPage con transiciones Material 3.
Page<dynamic> _adaptivePage({
  required LocalKey key,
  required Widget child,
  String? title,
}) {
  if (defaultTargetPlatform == TargetPlatform.iOS) {
    return CupertinoPage(
      key: key,
      title: title,
      child: child,
    );
  }
  return MaterialPage(
    key: key,
    child: child,
  );
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefreshNotifier();
  ref.listen(authControllerProvider, (_, _) => refresh.notify());
  ref.onDispose(refresh.dispose);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/inicio',
    refreshListenable: refresh,
    redirect: (context, state) {
      final location = state.uri.path;
      final isPanelRoute =
          location == '/admin' || location.startsWith('/admin/');
      if (!isPanelRoute) return null;

      final auth = ref.read(authControllerProvider);
      return NavigationMemory.panelRedirect(
        initialized: auth.initialized,
        user: auth.user,
        location: state.uri.toString(),
      );
    },
    routes: [
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) =>
            AppShell(location: state.uri.path, child: child),
        routes: [
          GoRoute(
            path: '/inicio',
            builder: (context, state) => const HomeScreen(),
          ),
          GoRoute(
            path: '/catalogo',
            builder: (context, state) => const CatalogScreen(),
          ),
          GoRoute(
            path: '/carrito',
            builder: (context, state) => const CartScreen(),
          ),
          GoRoute(
            path: '/cuenta',
            builder: (context, state) => const ProfileScreen(),
          ),
        ],
      ),
      GoRoute(path: '/admin', builder: (_, _) => const SizedBox.shrink()),
      ShellRoute(
        navigatorKey: _adminShellNavigatorKey,
        builder: (context, state, child) =>
            AdminShell(location: state.uri.path, child: child),
        routes: [
          GoRoute(
            path: '/admin/resumen',
            builder: (context, state) => const AdminDashboardScreen(),
          ),
          GoRoute(
            path: '/admin/inventario',
            builder: (context, state) => const AdminInventoryScreen(),
          ),
          GoRoute(
            path: '/admin/operaciones',
            builder: (context, state) => const AdminOperationsScreen(),
          ),
          GoRoute(
            path: '/admin/perfil',
            builder: (context, state) => const AdminProfileScreen(),
          ),
        ],
      ),
      GoRoute(
        path: '/admin/403',
        pageBuilder: (context, state) => _adaptivePage(
          key: state.pageKey,
          child: const OperationalAccessScreen(),
        ),
      ),
      GoRoute(
        path: '/productos/:id',
        pageBuilder: (context, state) => _adaptivePage(
          key: state.pageKey,
          child: ProductDetailScreen(
            productId: int.parse(state.pathParameters['id']!),
            branchId: int.tryParse(state.uri.queryParameters['sucursal'] ?? ''),
          ),
        ),
      ),
      GoRoute(
        path: '/login',
        pageBuilder: (context, state) => _adaptivePage(
          key: state.pageKey,
          child: const LoginScreen(),
        ),
      ),
      GoRoute(
        path: '/registro',
        pageBuilder: (context, state) => _adaptivePage(
          key: state.pageKey,
          child: const RegisterScreen(),
        ),
      ),
      GoRoute(
        path: '/recuperar-password',
        pageBuilder: (context, state) => _adaptivePage(
          key: state.pageKey,
          child: const PasswordRecoveryScreen(),
        ),
      ),
      GoRoute(
        path: '/checkout',
        pageBuilder: (context, state) => _adaptivePage(
          key: state.pageKey,
          child: const CheckoutScreen(),
        ),
      ),
      GoRoute(
        path: '/reservas',
        pageBuilder: (context, state) => _adaptivePage(
          key: state.pageKey,
          child: const ReservationsScreen(),
        ),
      ),
      GoRoute(
        path: '/pedidos',
        pageBuilder: (context, state) => _adaptivePage(
          key: state.pageKey,
          child: const OrdersScreen(),
        ),
      ),
      GoRoute(
        path: '/pedidos/:id',
        pageBuilder: (context, state) => _adaptivePage(
          key: state.pageKey,
          child: OrderDetailScreen(
            orderId: int.parse(state.pathParameters['id']!),
          ),
        ),
      ),
      GoRoute(
        path: '/direcciones',
        pageBuilder: (context, state) => _adaptivePage(
          key: state.pageKey,
          child: const AddressesScreen(),
        ),
      ),
      GoRoute(
        path: '/notificaciones',
        pageBuilder: (context, state) => _adaptivePage(
          key: state.pageKey,
          child: const NotificationsScreen(),
        ),
      ),
      GoRoute(
        path: '/vestidor',
        pageBuilder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? {};
          return _adaptivePage(
            key: state.pageKey,
            child: VirtualFittingScreen(
              product: extra['product'] as Product,
              measurements:
                  (extra['measurements'] as List<ProductMeasurement>?) ??
                      const [],
              initialVariant: extra['initialVariant'] as ProductVariant?,
              images: (extra['images'] as List<ProductImage>?) ?? const [],
            ),
          );
        },
      ),
    ],
  );
});

class _RouterRefreshNotifier extends ChangeNotifier {
  void notify() => notifyListeners();
}
