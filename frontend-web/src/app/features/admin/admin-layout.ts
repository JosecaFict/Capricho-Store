import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { ADMIN_NAVIGATION } from './admin-navigation';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <!-- THESIS: Un taller operativo de moda, no un mosaico SaaS; la tarea y el estado mandan. OWN-WORLD: papel frío, grafito, líneas cromadas y cobalto reservado a acción y selección. STORY: el equipo reconoce su alcance, entra al módulo permitido y actúa con contexto. FIRST VIEWPORT: rail lateral estable, cabecera de identidad y área de trabajo densa sin tarjetas decorativas. FORM: extensión Operate del sistema aprobado. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->
    <div class="admin-shell">
      <button
        class="admin-backdrop"
        [class.is-open]="menuOpen()"
        (click)="menuOpen.set(false)"
        aria-label="Cerrar menú"
      ></button>
      <aside
        class="admin-sidebar"
        [class.is-open]="menuOpen()"
        aria-label="Navegación administrativa"
      >
        <a class="admin-brand" routerLink="/admin" (click)="menuOpen.set(false)"
          ><span>CAPRICHO</span><small>OPERACIONES</small></a
        >
        <nav>
          @for (group of visibleNavigation(); track group.label) {
            <section class="admin-nav-group">
              <h2>{{ group.label }}</h2>
              @for (item of group.items; track item.path) {
                <a
                  [routerLink]="item.path"
                  routerLinkActive="active"
                  [routerLinkActiveOptions]="{ exact: item.path === '/admin' }"
                  (click)="menuOpen.set(false)"
                  >{{ item.label }}</a
                >
              }
            </section>
          }
        </nav>
        <a class="admin-public-link" routerLink="/">← Volver a la tienda</a>
      </aside>
      <div class="admin-workspace">
        <header class="admin-header">
          <button
            class="admin-menu-button"
            type="button"
            (click)="menuOpen.set(!menuOpen())"
            [attr.aria-expanded]="menuOpen()"
          >
            Menú
          </button>
          <div>
            <span class="admin-context">Panel operativo</span><strong>{{ roleLabel() }}</strong>
          </div>
          <div class="admin-user">
            <span>{{ user()?.nombres }} {{ user()?.apellidos }}</span
            ><button type="button" (click)="logout()">Cerrar sesión</button>
          </div>
        </header>
        <main class="admin-main" id="contenido"><router-outlet /></main>
      </div>
    </div>
  `,
})
export class AdminLayout {
  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
  readonly menuOpen = signal(false);
  readonly user = this.auth.currentUser;
  readonly roleLabel = computed(() => this.user()?.roles.join(' · ') || 'Sin rol asignado');
  readonly visibleNavigation = computed(() =>
    ADMIN_NAVIGATION.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permissions.length || this.permissions.hasAny(item.permissions),
      ),
    })).filter((group) => group.items.length),
  );

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
