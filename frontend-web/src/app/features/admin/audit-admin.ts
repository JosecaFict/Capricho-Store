import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AdminApiService, Entity } from './admin-api.service';

@Component({
  selector: 'app-audit-admin',
  imports: [CommonModule, ReactiveFormsModule],
  template: `<div class="admin-page audit-page">
    <header class="admin-page-heading audit-heading">
      <div>
        <h1>Bitácora de seguridad</h1>
        <p>Consulta quién realizó cada cambio, cuándo ocurrió y qué información se modificó.</p>
      </div>
      <div class="audit-total" aria-label="Total de registros">
        <strong>{{ pageData()['total'] || 0 }}</strong>
        <span>registros encontrados</span>
      </div>
    </header>

    <form [formGroup]="filters" (ngSubmit)="applyFilters()" class="admin-filterbar audit-filters">
      <label class="field audit-search">
        <span>Buscar</span>
        <input formControlName="buscar" placeholder="Usuario, entidad, registro o solicitud" />
      </label>
      <label class="field">
        <span>Módulo</span>
        <select formControlName="modulo">
          <option value="">Todos</option>
          @for (module of modules; track module) {
            <option [value]="module">{{ module }}</option>
          }
        </select>
      </label>
      <label class="field">
        <span>Acción</span>
        <select formControlName="accion">
          <option value="">Todas</option>
          <option value="INSERT">Creación</option>
          <option value="UPDATE">Actualización</option>
          <option value="DELETE">Eliminación</option>
        </select>
      </label>
      <label class="field">
        <span>Desde</span>
        <input type="date" formControlName="fecha_desde" />
      </label>
      <label class="field">
        <span>Hasta</span>
        <input type="date" formControlName="fecha_hasta" />
      </label>
      <div class="audit-filter-actions">
        <button class="button button--primary" type="submit">Aplicar</button>
        <button class="button button--quiet" type="button" (click)="clearFilters()">Limpiar</button>
      </div>
    </form>

    @if (message()) {
      <div class="notice notice--error" role="alert">{{ message() }}</div>
    }

    @if (loading()) {
      <div class="admin-skeleton" aria-label="Cargando registros"></div>
    } @else {
      <div class="admin-table-wrap audit-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha y hora</th>
              <th>Acción</th>
              <th>Módulo / entidad</th>
              <th>Usuario</th>
              <th>Origen</th>
              <th><span class="sr-only">Detalle</span></th>
            </tr>
          </thead>
          <tbody>
            @for (log of pageData()['items']; track log['id_bitacora']) {
              <tr>
                <td>
                  <time [attr.datetime]="log['fecha_hora']">
                    {{ log['fecha_hora'] | date: 'dd/MM/yyyy HH:mm:ss' }}
                  </time>
                  <small>#{{ log['id_bitacora'] }}</small>
                </td>
                <td>
                  <span class="audit-action" [attr.data-action]="log['accion']">
                    {{ actionLabel(log['accion']) }}
                  </span>
                </td>
                <td>
                  <strong>{{ log['modulo'] }}</strong>
                  <small>{{ log['entidad'] }} · registro {{ log['id_registro'] || '—' }}</small>
                </td>
                <td>
                  <strong>{{ log['usuario'] || 'Sistema' }}</strong>
                  <small>{{ log['correo_usuario'] || 'Sin usuario autenticado' }}</small>
                </td>
                <td>
                  {{ log['origen'] || 'SISTEMA' }}
                  <small>{{ log['direccion_ip'] || 'IP no disponible' }}</small>
                </td>
                <td class="admin-row-actions">
                  <button
                    type="button"
                    [attr.aria-expanded]="selectedId() === log['id_bitacora']"
                    (click)="toggleDetail(log)"
                  >
                    {{ selectedId() === log['id_bitacora'] ? 'Ocultar' : 'Ver detalle' }}
                  </button>
                </td>
              </tr>
              @if (selectedId() === log['id_bitacora']) {
                <tr class="audit-detail-row">
                  <td colspan="6">
                    @if (detailLoading()) {
                      <p class="audit-detail-loading">Cargando detalle…</p>
                    } @else if (selected(); as detail) {
                      <section class="audit-detail" aria-label="Detalle del registro de bitácora">
                        <div class="audit-trace">
                          <div>
                            <span>Solicitud</span>
                            <strong>{{ detail['request_id'] || 'No disponible' }}</strong>
                          </div>
                          <div>
                            <span>Sesión</span>
                            <strong>{{ detail['id_sesion'] || 'No disponible' }}</strong>
                          </div>
                          <div>
                            <span>Navegador o cliente</span>
                            <strong>{{ detail['user_agent'] || 'No disponible' }}</strong>
                          </div>
                        </div>
                        <div class="audit-comparison">
                          <div>
                            <h3>Datos anteriores</h3>
                            <pre>{{ detail['datos_anteriores'] | json }}</pre>
                          </div>
                          <div>
                            <h3>Datos nuevos</h3>
                            <pre>{{ detail['datos_nuevos'] | json }}</pre>
                          </div>
                        </div>
                      </section>
                    }
                  </td>
                </tr>
              }
            } @empty {
              <tr>
                <td colspan="6" class="audit-empty">
                  <strong>No se encontraron registros</strong>
                  <span>Prueba ampliando las fechas o limpiando los filtros.</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if ((pageData()['pages'] || 0) > 1) {
        <nav class="audit-pagination" aria-label="Paginación de bitácora">
          <button
            class="button button--quiet"
            type="button"
            [disabled]="page() === 1"
            (click)="goToPage(page() - 1)"
          >
            Anterior
          </button>
          <span>Página {{ page() }} de {{ pageData()['pages'] }}</span>
          <button
            class="button button--quiet"
            type="button"
            [disabled]="page() === pageData()['pages']"
            (click)="goToPage(page() + 1)"
          >
            Siguiente
          </button>
        </nav>
      }
    }
  </div>`,
})
export class AuditAdmin implements OnInit {
  private api = inject(AdminApiService);
  private fb = inject(FormBuilder);
  private errors = inject(ApiErrorService);

  readonly modules = [
    'SEGURIDAD',
    'CATALOGO',
    'PROVEEDORES',
    'INVENTARIO',
    'RESERVAS',
    'VENTAS',
    'PAGOS',
    'DEVOLUCIONES',
    'MARKETING',
  ];
  readonly filters = this.fb.group({
    buscar: [''],
    modulo: [''],
    accion: [''],
    fecha_desde: [''],
    fecha_hasta: [''],
  });
  pageData = signal<Entity>({ items: [], page: 1, page_size: 25, total: 0, pages: 0 });
  page = signal(1);
  selectedId = signal<number | null>(null);
  selected = signal<Entity | null>(null);
  loading = signal(true);
  detailLoading = signal(false);
  message = signal('');

  ngOnInit() {
    this.load();
  }

  applyFilters() {
    this.page.set(1);
    this.selectedId.set(null);
    this.selected.set(null);
    this.load();
  }

  clearFilters() {
    this.filters.reset({ buscar: '', modulo: '', accion: '', fecha_desde: '', fecha_hasta: '' });
    this.applyFilters();
  }

  goToPage(page: number) {
    this.page.set(page);
    this.selectedId.set(null);
    this.selected.set(null);
    this.load();
  }

  toggleDetail(log: Entity) {
    const id = Number(log['id_bitacora']);
    if (this.selectedId() === id) {
      this.selectedId.set(null);
      this.selected.set(null);
      return;
    }
    this.selectedId.set(id);
    this.selected.set(null);
    this.detailLoading.set(true);
    this.api
      .get(`audit-logs/${id}`)
      .pipe(finalize(() => this.detailLoading.set(false)))
      .subscribe({
        next: (detail) => this.selected.set(detail),
        error: (error) => this.message.set(this.errors.message(error)),
      });
  }

  actionLabel(action: string) {
    return { INSERT: 'Creación', UPDATE: 'Actualización', DELETE: 'Eliminación' }[action] ?? action;
  }

  private load() {
    const values = this.filters.getRawValue();
    this.loading.set(true);
    this.message.set('');
    this.api
      .query('audit-logs', {
        page: this.page(),
        page_size: 25,
        buscar: values.buscar || undefined,
        modulo: values.modulo || undefined,
        accion: values.accion || undefined,
        fecha_desde: values.fecha_desde || undefined,
        fecha_hasta: values.fecha_hasta || undefined,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.pageData.set(data),
        error: (error) => this.message.set(this.errors.message(error)),
      });
  }
}
