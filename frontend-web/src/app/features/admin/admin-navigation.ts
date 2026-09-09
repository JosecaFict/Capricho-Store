export interface AdminNavItem {
  label: string;
  path: string;
  permissions: string[];
  exact?: boolean;
}
export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAVIGATION: AdminNavGroup[] = [
  {
    label: 'Vista general',
    items: [{ label: 'Dashboard', path: '/admin', permissions: [], exact: true }],
  },
  {
    label: 'Personal',
    items: [{ label: 'Empleados', path: '/admin/empleados', permissions: ['empleados.ver'] }],
  },
  {
    label: 'Catálogo',
    items: [
      {
        label: 'Productos',
        path: '/admin/productos',
        permissions: ['productos.ver', 'productos.crear', 'productos.editar'],
      },
      {
        label: 'Datos maestros',
        path: '/admin/catalogo/datos-maestros',
        permissions: ['productos.crear', 'productos.editar'],
      },
    ],
  },
  {
    label: 'Compras',
    items: [
      {
        label: 'Proveedores',
        path: '/admin/proveedores',
        permissions: ['proveedores.ver', 'proveedores.gestionar'],
      },
      {
        label: 'Órdenes de compra',
        path: '/admin/ordenes-compra',
        permissions: ['proveedores.ver', 'proveedores.gestionar'],
      },
      { label: 'Recepciones', path: '/admin/recepciones', permissions: ['recepcion.registrar'] },
    ],
  },
  {
    label: 'Inventario',
    items: [
      {
        label: 'Existencias',
        path: '/admin/inventario',
        permissions: ['inventario.ver'],
        exact: true,
      },
      { label: 'Lotes', path: '/admin/inventario/lotes', permissions: ['inventario.ver'] },
      {
        label: 'Movimientos',
        path: '/admin/inventario/movimientos',
        permissions: ['inventario.ver'],
      },
      {
        label: 'Transferencias',
        path: '/admin/inventario/transferencias',
        permissions: ['inventario.ver', 'inventario.movimiento'],
      },
    ],
  },
  {
    label: 'Seguridad',
    items: [
      {
        label: 'Roles y permisos',
        path: '/admin/seguridad/roles-permisos',
        permissions: ['permisos.asignar'],
      },
      {
        label: 'Bitácora',
        path: '/admin/seguridad/bitacora',
        permissions: ['permisos.asignar'],
      },
    ],
  },
];

export function visibleAdminNavigation(permissionCodes: readonly string[]): AdminNavGroup[] {
  const permissions = new Set(permissionCodes);
  return ADMIN_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        !item.permissions.length ||
        item.permissions.some((permission) => permissions.has(permission)),
    ),
  })).filter((group) => group.items.length);
}

export function availableAdminModules(permissionCodes: readonly string[]): AdminNavItem[] {
  return visibleAdminNavigation(permissionCodes)
    .flatMap((group) => group.items)
    .filter((item) => item.path !== '/admin');
}
