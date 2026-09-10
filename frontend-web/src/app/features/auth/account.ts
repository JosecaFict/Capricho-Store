import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionService } from '../../core/permissions/permission.service';

@Component({
  selector: 'app-account',
  imports: [RouterLink],
  template: `
    <section class="account-page page-shell">
      @if (auth.currentUser(); as user) {
        <div class="account-heading">
          <p>Mi cuenta</p>
          <h1>{{ user.nombres }} {{ user.apellidos }}</h1>
          <span class="status-chip">{{ user.estado }}</span>
        </div>
        <dl class="account-details">
          <div>
            <dt>Correo</dt>
            <dd>{{ user.correo }}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>{{ user.telefono || 'No registrado' }}</dd>
          </div>
          <div>
            <dt>CI</dt>
            <dd>{{ user.ci || 'No registrado' }}</dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd>{{ user.roles.join(', ') || 'Cliente' }}</dd>
          </div>
          @if (user.sucursal) {
            <div>
              <dt>Sucursal asignada</dt>
              <dd>{{ user.sucursal }}</dd>
            </div>
          }
        </dl>
        <div class="account-actions">
          @if (permissions.hasAdminAccess()) {
            <a class="button button--primary" routerLink="/admin">Ir al panel administrativo</a>
          }
          <a class="button button--secondary" routerLink="/catalogo">Explorar catálogo</a>
          <a class="button button--secondary" routerLink="/pedidos">Mis pedidos</a>
          <a class="button button--secondary" routerLink="/reservas">Mis reservas</a>
          <a class="button button--secondary" routerLink="/historial">Historial</a>
          <a class="button button--secondary" routerLink="/direcciones">Direcciones</a>
          <a class="button button--quiet" routerLink="/notificaciones">Notificaciones</a>
        </div>
      } @else {
        <p>Cargando tu cuenta…</p>
      }
    </section>
  `,
})
export class Account {
  readonly auth = inject(AuthService);
  readonly permissions = inject(PermissionService);
}
