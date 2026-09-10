import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import {
  adminGuard,
  requireAllPermissions,
  requireAnyPermission,
} from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layouts/public-layout/public-layout').then((m) => m.PublicLayout),
    children: [
      {
        path: '',
        title: 'Capricho Store | Moda para ti',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'catalogo',
        title: 'Catálogo | Capricho Store',
        loadComponent: () => import('./features/catalog/catalog').then((m) => m.Catalog),
      },
      {
        path: 'productos/:id',
        title: 'Producto | Capricho Store',
        loadComponent: () =>
          import('./features/catalog/product-detail').then((m) => m.ProductDetail),
      },
      {
        path: 'login',
        title: 'Ingresar | Capricho Store',
        loadComponent: () => import('./features/auth/login').then((m) => m.Login),
      },
      {
        path: 'registro',
        title: 'Crear cuenta | Capricho Store',
        loadComponent: () => import('./features/auth/register').then((m) => m.Register),
      },
      {
        path: 'recuperar-contrasena',
        title: 'Recuperar contraseña | Capricho Store',
        loadComponent: () =>
          import('./features/auth/password-recovery').then((m) => m.PasswordRecovery),
      },
      {
        path: 'cuenta',
        title: 'Mi cuenta | Capricho Store',
        canActivate: [authGuard],
        loadComponent: () => import('./features/auth/account').then((m) => m.Account),
      },
      {
        path: 'carrito',
        title: 'Carrito | Capricho Store',
        canActivate: [authGuard],
        loadComponent: () => import('./features/commerce/commerce-pages').then((m) => m.CartPage),
      },
      {
        path: 'checkout',
        title: 'Confirmar pedido | Capricho Store',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/commerce/commerce-pages').then((m) => m.CheckoutPage),
      },
      {
        path: 'reservas',
        title: 'Reservas | Capricho Store',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/commerce/commerce-pages').then((m) => m.ReservationsPage),
      },
      {
        path: 'pedidos',
        title: 'Pedidos | Capricho Store',
        canActivate: [authGuard],
        loadComponent: () => import('./features/commerce/commerce-pages').then((m) => m.OrdersPage),
      },
      {
        path: 'historial',
        title: 'Historial | Capricho Store',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/commerce/commerce-pages').then((m) => m.HistoryPage),
      },
      {
        path: 'direcciones',
        title: 'Direcciones | Capricho Store',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/commerce/commerce-pages').then((m) => m.AddressesPage),
      },
      {
        path: 'notificaciones',
        title: 'Notificaciones | Capricho Store',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/commerce/commerce-pages').then((m) => m.NotificationsPage),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./features/admin/admin-layout').then((m) => m.AdminLayout),
    children: [
      {
        path: '403',
        loadComponent: () =>
          import('./features/admin/admin-status-pages').then((m) => m.AdminForbidden),
      },
      {
        path: '',
        pathMatch: 'full',
        canActivate: [adminGuard],
        title: 'Panel operativo | Capricho Store',
        loadComponent: () => import('./features/admin/dashboard').then((m) => m.AdminDashboard),
      },
      {
        path: 'empleados',
        canActivate: [requireAnyPermission('empleados.ver')],
        loadComponent: () =>
          import('./features/admin/employees-admin').then((m) => m.EmployeesAdmin),
      },
      {
        path: 'empleados/:id',
        canActivate: [requireAnyPermission('empleados.ver')],
        loadComponent: () =>
          import('./features/admin/employees-admin').then((m) => m.EmployeeDetail),
      },
      {
        path: 'organizacion/sucursales',
        title: 'Sucursales | Capricho Store',
        canActivate: [requireAnyPermission('sucursales.ver')],
        loadComponent: () => import('./features/admin/branches-admin').then((m) => m.BranchesAdmin),
      },
      {
        path: 'productos',
        canActivate: [requireAnyPermission('productos.ver', 'productos.crear', 'productos.editar')],
        loadComponent: () => import('./features/admin/catalog-admin').then((m) => m.ProductsAdmin),
      },
      {
        path: 'productos/:id',
        canActivate: [requireAnyPermission('productos.ver', 'productos.crear', 'productos.editar')],
        loadComponent: () =>
          import('./features/admin/catalog-admin').then((m) => m.ProductAdminDetail),
      },
      {
        path: 'catalogo/datos-maestros',
        canActivate: [requireAnyPermission('productos.crear', 'productos.editar')],
        loadComponent: () =>
          import('./features/admin/catalog-admin').then((m) => m.MasterDataAdmin),
      },
      {
        path: 'proveedores',
        canActivate: [requireAnyPermission('proveedores.ver', 'proveedores.gestionar')],
        loadComponent: () =>
          import('./features/admin/operations-admin').then((m) => m.SuppliersAdmin),
      },
      {
        path: 'proveedores/:id',
        canActivate: [requireAnyPermission('proveedores.ver', 'proveedores.gestionar')],
        loadComponent: () =>
          import('./features/admin/operations-admin').then((m) => m.SupplierDetail),
      },
      {
        path: 'ordenes-compra',
        canActivate: [requireAnyPermission('proveedores.ver', 'proveedores.gestionar')],
        loadComponent: () =>
          import('./features/admin/operations-admin').then((m) => m.PurchasesAdmin),
      },
      {
        path: 'recepciones',
        canActivate: [requireAnyPermission('recepcion.registrar')],
        loadComponent: () =>
          import('./features/admin/operations-admin').then((m) => m.ReceiptsAdmin),
      },
      {
        path: 'compras-proveedores',
        canActivate: [requireAnyPermission('proveedores.ver')],
        loadComponent: () =>
          import('./features/admin/commerce-admin').then((m) => m.SupplierHistoryAdmin),
      },
      {
        path: 'ventas',
        canActivate: [requireAllPermissions('ventas.crear', 'pagos.registrar')],
        loadComponent: () => import('./features/admin/commerce-admin').then((m) => m.PosSalesAdmin),
      },
      {
        path: 'pedidos',
        canActivate: [requireAnyPermission('ventas.ver')],
        loadComponent: () => import('./features/admin/commerce-admin').then((m) => m.OrdersAdmin),
      },
      {
        path: 'reservas',
        canActivate: [requireAnyPermission('reservas.ver')],
        loadComponent: () =>
          import('./features/admin/commerce-admin').then((m) => m.ReservationsAdmin),
      },
      {
        path: 'devoluciones',
        canActivate: [requireAnyPermission('ventas.ver')],
        loadComponent: () => import('./features/admin/commerce-admin').then((m) => m.ReturnsAdmin),
      },
      {
        path: 'inventario',
        canActivate: [requireAnyPermission('inventario.ver')],
        loadComponent: () =>
          import('./features/admin/operations-admin').then((m) => m.InventoryAdmin),
      },
      {
        path: 'inventario/lotes',
        canActivate: [requireAnyPermission('inventario.ver')],
        data: { mode: 'lots' },
        loadComponent: () => import('./features/admin/operations-admin').then((m) => m.TraceAdmin),
      },
      {
        path: 'inventario/movimientos',
        canActivate: [requireAnyPermission('inventario.ver')],
        data: { mode: 'movements' },
        loadComponent: () => import('./features/admin/operations-admin').then((m) => m.TraceAdmin),
      },
      {
        path: 'inventario/transferencias',
        canActivate: [requireAnyPermission('inventario.ver', 'inventario.movimiento')],
        data: { mode: 'transfers' },
        loadComponent: () => import('./features/admin/operations-admin').then((m) => m.TraceAdmin),
      },
      {
        path: 'seguridad/roles-permisos',
        title: 'Roles y permisos | Capricho Store',
        canActivate: [requireAnyPermission('permisos.asignar')],
        loadComponent: () =>
          import('./features/admin/employees-admin').then((m) => m.RolesPermissionsAdmin),
      },
      {
        path: 'seguridad/bitacora',
        title: 'Bitácora de seguridad | Capricho Store',
        canActivate: [requireAnyPermission('permisos.asignar')],
        loadComponent: () => import('./features/admin/audit-admin').then((m) => m.AuditAdmin),
      },
      {
        path: '**',
        loadComponent: () =>
          import('./features/admin/admin-status-pages').then((m) => m.AdminNotFound),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
