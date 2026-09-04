import 'package:capricho_store/features/auth/presentation/login_screen.dart';
import 'package:capricho_store/features/auth/presentation/profile_screen.dart';
import 'package:capricho_store/features/auth/presentation/register_screen.dart';
import 'package:capricho_store/features/catalog/presentation/catalog_screen.dart';
import 'package:capricho_store/features/catalog/presentation/product_detail_screen.dart';
import 'package:capricho_store/shared/widgets/app_shell.dart';
import 'package:go_router/go_router.dart';

final appRouter = GoRouter(
  initialLocation: '/catalogo',
  routes: [
    ShellRoute(
      builder: (context, state, child) =>
          AppShell(location: state.uri.path, child: child),
      routes: [
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
  ],
);
