import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { NotificationBell } from '../../shared/components/notification-bell/notification-bell';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive, NotificationBell],
  template: `
    <header class="site-header">
      <a class="brand" routerLink="/" aria-label="Capricho Store, ir al inicio">
        <span>CAPRICHO</span><small>STORE</small>
      </a>
      <button
        class="menu-button"
        type="button"
        (click)="menuOpen.update((value) => !value)"
        [attr.aria-expanded]="menuOpen()"
        aria-controls="public-navigation"
      >
        Menú
      </button>
      <nav
        id="public-navigation"
        class="site-nav"
        [class.site-nav--open]="menuOpen()"
        aria-label="Navegación principal"
      >
        <a
          routerLink="/"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          (click)="closeMenu()"
          >Inicio</a
        >
        <a routerLink="/catalogo" routerLinkActive="active" (click)="closeMenu()">Catálogo</a>
        @if (auth.currentUser()) {
          @if (!permissions.hasAdminAccess()) {
            <a routerLink="/carrito" routerLinkActive="active" (click)="closeMenu()">Carrito</a>
          }
          <app-notification-bell mode="public" />
          @if (permissions.hasAdminAccess()) {
            <a
              class="nav-admin-badge"
              routerLink="/admin"
              routerLinkActive="active"
              (click)="closeMenu()"
              title="Ir al panel operativo"
              aria-label="Ir al panel operativo"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true">
                <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <rect x="3" y="7" width="18" height="14" rx="3" />
                <line x1="3" y1="13" x2="10" y2="13" />
                <line x1="14" y1="13" x2="21" y2="13" />
                <rect x="10" y="11" width="4" height="5" rx="1" />
              </svg>
            </a>
          } @else {
            <a routerLink="/cuenta" routerLinkActive="active" (click)="closeMenu()">Mi cuenta</a>
            <button class="nav-action" type="button" (click)="logout()">Cerrar sesión</button>
          }
        } @else {
          <a routerLink="/login" routerLinkActive="active" (click)="closeMenu()">Ingresar</a>
          <a class="nav-signup" routerLink="/registro" (click)="closeMenu()">Crear cuenta</a>
        }
      </nav>
    </header>
  `,
})
export class SiteHeader {
  readonly auth = inject(AuthService);
  readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
  readonly menuOpen = signal(false);

  constructor() {
    this.auth.restoreSession();
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }
  logout(): void {
    this.auth.logout();
    this.closeMenu();
    void this.router.navigateByUrl('/');
  }
}
