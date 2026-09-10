import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AdminNavGroup, visibleAdminNavigation } from './admin-navigation';

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
            <section class="admin-nav-group" [class.is-expanded]="isGroupExpanded(group)">
              <h2>
                <button
                  type="button"
                  class="admin-nav-trigger"
                  (click)="toggleGroup(group)"
                  [attr.aria-expanded]="isGroupExpanded(group)"
                  [attr.aria-controls]="'admin-nav-group-' + $index"
                  [attr.aria-label]="
                    (isGroupExpanded(group) ? 'Ocultar ' : 'Mostrar ') + group.label
                  "
                >
                  <span>{{ group.label }}</span>
                  <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
                    <path d="M6 3.5 10.5 8 6 12.5" />
                  </svg>
                </button>
              </h2>
              <div [id]="'admin-nav-group-' + $index" [hidden]="!isGroupExpanded(group)">
                @for (item of group.items; track item.path) {
                  <a
                    [routerLink]="item.path"
                    routerLinkActive="active"
                    [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                    (click)="menuOpen.set(false)"
                    >{{ item.label }}</a
                  >
                }
              </div>
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
            <span class="admin-context">Panel operativo</span>
            <strong>{{ roleLabel() }}</strong>
            <small class="admin-branch-context">{{ branchLabel() }}</small>
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
  private readonly router = inject(Router);
  readonly menuOpen = signal(false);
  readonly expandedGroups = signal<Record<string, boolean>>({});
  readonly user = this.auth.currentUser;
  readonly roleLabel = computed(() => this.user()?.roles.join(' · ') || 'Sin rol asignado');
  readonly branchLabel = computed(() => {
    const user = this.user();
    if (user?.roles.includes('ADMIN')) return 'Todas las sucursales';
    return user?.sucursal ? `Sucursal asignada: ${user.sucursal}` : 'Sin sucursal asignada';
  });
  readonly visibleNavigation = computed(() => visibleAdminNavigation(this.user()?.permisos ?? []));

  isGroupExpanded(group: AdminNavGroup): boolean {
    return this.expandedGroups()[group.label] ?? this.isGroupActive(group);
  }

  toggleGroup(group: AdminNavGroup): void {
    const expanded = this.isGroupExpanded(group);
    this.expandedGroups.update((groups) => ({ ...groups, [group.label]: !expanded }));
  }

  private isGroupActive(group: AdminNavGroup): boolean {
    const currentPath = this.router.url.split(/[?#]/, 1)[0];
    return group.items.some((item) =>
      item.exact
        ? currentPath === item.path
        : currentPath === item.path || currentPath.startsWith(`${item.path}/`),
    );
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
