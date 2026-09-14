import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AdminNavGroup, visibleAdminNavigation } from './admin-navigation';
import { NotificationBell } from '../../shared/components/notification-bell/notification-bell';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NotificationBell],
  template: `
    <!-- THESIS: Un taller operativo de moda, no un mosaico SaaS; la tarea y el estado mandan. OWN-WORLD: papel frío, grafito, líneas cromadas y cobalto reservado a acción y selección. STORY: el equipo reconoce su alcance, entra al módulo permitido y actúa con contexto. FIRST VIEWPORT: rail lateral estable, cabecera de identidad y área de trabajo densa sin tarjetas decorativas. FORM: extensión Operate del sistema aprobado. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->
    <div class="admin-shell" [class.sidebar-collapsed]="sidebarCollapsed()">
      <button
        class="admin-backdrop"
        [class.is-open]="menuOpen()"
        (click)="menuOpen.set(false)"
        aria-label="Cerrar menú"
      ></button>
      <aside
        class="admin-sidebar"
        [class.is-open]="menuOpen()"
        [class.is-collapsed]="sidebarCollapsed()"
        aria-label="Navegación administrativa"
      >
        <div class="admin-brand-row">
          <a class="admin-brand" routerLink="/admin" (click)="menuOpen.set(false)"
            ><span>CAPRICHO</span><small>OPERACIONES</small></a
          >
          <button
            type="button"
            class="admin-sidebar-collapse-btn"
            (click)="toggleSidebar()"
            title="Ocultar menú lateral"
            aria-label="Ocultar menú lateral"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
        </div>
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
          <div class="admin-header__left">
            <button
              class="admin-menu-toggle-btn"
              type="button"
              (click)="toggleSidebar()"
              [attr.aria-label]="sidebarCollapsed() ? 'Mostrar menú lateral' : 'Ocultar menú lateral'"
              [title]="sidebarCollapsed() ? 'Mostrar menú' : 'Ocultar menú'"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" aria-hidden="true">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div class="admin-header__titles">
              <span class="admin-context">Panel operativo</span>
              <strong>{{ roleLabel() }}</strong>
              <small class="admin-branch-context">{{ branchLabel() }}</small>
            </div>
          </div>
          <div class="admin-user">
            <app-notification-bell mode="admin" />
            <span>{{ user()?.nombres }} {{ user()?.apellidos }}</span>
            <button type="button" (click)="logout()">Cerrar sesión</button>
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
  readonly sidebarCollapsed = signal(false);
  readonly expandedGroups = signal<Record<string, boolean>>({});
  readonly user = this.auth.currentUser;
  readonly roleLabel = computed(() => this.user()?.roles.join(' · ') || 'Sin rol asignado');
  readonly branchLabel = computed(() => {
    const user = this.user();
    if (user?.roles.includes('ADMIN')) return 'Todas las sucursales';
    return user?.sucursal ? `Sucursal asignada: ${user.sucursal}` : 'Sin sucursal asignada';
  });
  readonly visibleNavigation = computed(() => visibleAdminNavigation(this.user()?.permisos ?? []));

  constructor() {
    if (typeof window !== 'undefined' && window.localStorage) {
      this.sidebarCollapsed.set(
        localStorage.getItem('capricho_admin_sidebar_collapsed') === 'true',
      );
    }
  }

  toggleSidebar(): void {
    if (typeof window !== 'undefined' && window.innerWidth < 960) {
      this.menuOpen.update((open) => !open);
    } else {
      const next = !this.sidebarCollapsed();
      this.sidebarCollapsed.set(next);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('capricho_admin_sidebar_collapsed', String(next));
      }
    }
  }

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

