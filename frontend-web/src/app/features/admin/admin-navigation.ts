export interface AdminNavItem {
  label: string;
  path: string;
  permissions: string[];
}
export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAVIGATION: AdminNavGroup[] = [
  { label: 'Vista general', items: [{ label: 'Dashboard', path: '/admin', permissions: [] }] },
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
        permissions: ['productos.ver', 'productos.crear', 'productos.editar'],
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
      { label: 'Existencias', path: '/admin/inventario', permissions: ['inventario.ver'] },
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
        label: 'Bitácora',
        path: '/admin/seguridad/bitacora',
        permissions: ['permisos.asignar'],
      },
    ],
  },
];
