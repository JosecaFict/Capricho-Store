import 'package:capricho_store/features/admin/presentation/admin_dashboard_screen.dart';
import 'package:capricho_store/features/admin/presentation/admin_inventory_screen.dart';
import 'package:capricho_store/features/admin/presentation/admin_operations_screen.dart';
import 'package:capricho_store/features/admin/presentation/admin_profile_screen.dart';
import 'package:capricho_store/features/admin/presentation/admin_shell.dart';
import 'package:capricho_store/features/auth/presentation/login_screen.dart';
import 'package:capricho_store/features/auth/presentation/password_recovery_screen.dart';
import 'package:capricho_store/features/auth/presentation/profile_screen.dart';
import 'package:capricho_store/features/auth/presentation/register_screen.dart';
import 'package:capricho_store/features/catalog/presentation/catalog_screen.dart';
import 'package:capricho_store/features/catalog/presentation/product_detail_screen.dart';
import 'package:capricho_store/features/home/presentation/home_screen.dart';
import 'package:capricho_store/shared/widgets/app_shell.dart';
import 'package:go_router/go_router.dart';

final appRouter = GoRouter(
  initialLocation: '/inicio',
  routes: [
    ShellRoute(
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
          path: '/cuenta',
          builder: (context, state) => const ProfileScreen(),
        ),
      ],
    ),
    GoRoute(
      path: '/admin',
      redirect: (context, state) => '/admin/resumen',
    ),
    ShellRoute(
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
      path: '/productos/:id',
      builder: (context, state) => ProductDetailScreen(
        productId: int.parse(state.pathParameters['id']!),
      ),
    ),
    GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
    GoRoute(
      path: '/registro',
      builder: (context, state) => const RegisterScreen(),
    ),
    GoRoute(
      path: '/recuperar-password',
      builder: (context, state) => const PasswordRecoveryScreen(),
    ),
  ],
);
