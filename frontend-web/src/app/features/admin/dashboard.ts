import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { ADMIN_NAVIGATION } from './admin-navigation';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink],
  template: `
    <div class="admin-page">
      <header class="admin-page-heading">
        <div>
          <p class="eyebrow">Ciclo I · Operaciones</p>
          <h1>Buen trabajo, {{ user()?.nombres }}</h1>
          <p>Accede únicamente a las herramientas habilitadas por tus permisos efectivos.</p>
        </div>
        <span class="status-chip">{{ user()?.estado }}</span>
      </header>
      <section class="admin-dashboard-band" aria-labelledby="scope-title">
        <div>
          <span>{{ permissionCount() }}</span
          ><small>permisos efectivos</small>
        </div>
        <div>
          <span>{{ moduleCount() }}</span
          ><small>módulos disponibles</small>
        </div>
        <div class="admin-dashboard-copy">
          <h2 id="scope-title">Tu espacio de trabajo</h2>
          <p>
            FastAPI valida cada operación. Esta interfaz adapta la navegación, pero no reemplaza la
            autorización del servidor.
          </p>
        </div>
      </section>
      <section class="admin-quick">
        <header>
          <h2>Accesos rápidos</h2>
          <p>Continúa con una tarea disponible para tu rol.</p>
        </header>
        <div class="admin-link-grid">
          @for (item of quickLinks(); track item.path) {
            <a [routerLink]="item.path"
              ><span>{{ item.label }}</span
              ><small>Abrir módulo →</small></a
            >
          }
        </div>
      </section>
    </div>
  `,
})
export class AdminDashboard {
  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionService);
  readonly user = this.auth.currentUser;
  readonly permissionCount = computed(() => this.user()?.permisos.length ?? 0);
  readonly quickLinks = computed(() =>
    ADMIN_NAVIGATION.flatMap((g) => g.items)
      .filter((i) => i.path !== '/admin' && this.permissions.hasAny(i.permissions))
      .slice(0, 6),
  );
  readonly moduleCount = computed(() => this.quickLinks().length);
}
