import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionService } from '../../core/permissions/permission.service';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
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
          @if (permissions.hasAdminAccess()) {
            <a
              class="nav-admin"
              routerLink="/admin"
              routerLinkActive="active"
              (click)="closeMenu()"
              >Panel administrativo</a
            >
          }
          <a routerLink="/cuenta" routerLinkActive="active" (click)="closeMenu()">Mi cuenta</a>
          <button class="nav-action" type="button" (click)="logout()">Cerrar sesión</button>
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
