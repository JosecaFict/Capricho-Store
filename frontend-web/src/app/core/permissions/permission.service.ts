import { computed, inject, Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export const ADMIN_PERMISSIONS = [
  'empleados.ver',
  'empleados.crear',
  'empleados.editar',
  'permisos.asignar',
  'sucursales.ver',
  'sucursales.crear',
  'sucursales.editar',
  'productos.ver',
  'productos.crear',
  'productos.editar',
  'proveedores.ver',
  'proveedores.gestionar',
  'recepcion.registrar',
  'inventario.ver',
  'inventario.movimiento',
] as const;

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);
  readonly permissions = computed(() => new Set(this.auth.currentUser()?.permisos ?? []));
  readonly hasAdminAccess = computed(() => ADMIN_PERMISSIONS.some((p) => this.has(p)));

  has(permission: string): boolean {
    return this.permissions().has(permission);
  }

  hasAny(permissions: readonly string[]): boolean {
    return permissions.some((permission) => this.has(permission));
  }
}
