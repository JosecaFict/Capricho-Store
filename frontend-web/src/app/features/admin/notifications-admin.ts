import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  AdminNotificationPage,
  AdminOperationalNotification,
  CustomerAdminSummary,
  NotificationKpis,
} from '../../core/models/commerce.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CommerceService } from '../../core/services/commerce.service';

@Component({
  selector: 'app-notifications-admin',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="admin-page">
      <header class="admin-page-heading">
        <div>
          <p class="eyebrow">Ventas y pedidos</p>
          <h1>Notificaciones Operativas</h1>
          <p>Supervisión de avisos automáticos de pedidos, reservas, devoluciones y despacho de comunicados directos.</p>
        </div>
        <div class="admin-page-heading__actions">
          <button class="button button--primary" (click)="openComposeModal()">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Nuevo aviso operativo
          </button>
        </div>
      </header>

      @if (errorMessage()) {
        <div class="admin-notice admin-notice--error">
          <span>{{ errorMessage() }}</span>
          <button type="button" class="button button--ghost button--small" (click)="errorMessage.set(null)" style="margin-left: auto;">✕</button>
        </div>
      }

      <!-- KPI Grid -->
      <section class="notification-kpi-grid">
        <div class="notification-kpi-card">
          <span class="notification-kpi-card__label">Total Emitidas</span>
          <strong class="notification-kpi-card__value">{{ kpis().total }}</strong>
          <span class="notification-kpi-card__sub">Comunicaciones registradas</span>
        </div>
        <div class="notification-kpi-card notification-kpi-card--success">
          <span class="notification-kpi-card__label">Entregadas / Enviadas</span>
          <strong class="notification-kpi-card__value">{{ kpis().enviadas }}</strong>
          <span class="notification-kpi-card__sub">Confirmadas sin incidencias</span>
        </div>
        <div class="notification-kpi-card notification-kpi-card--warning">
          <span class="notification-kpi-card__label">Pendientes en Cola</span>
          <strong class="notification-kpi-card__value">{{ kpis().pendientes }}</strong>
          <span class="notification-kpi-card__sub">En procesamiento o espera</span>
        </div>
        <div class="notification-kpi-card notification-kpi-card--danger">
          <span class="notification-kpi-card__label">Fallidas</span>
          <strong class="notification-kpi-card__value">{{ kpis().fallidas }}</strong>
          <span class="notification-kpi-card__sub">Requieren reintento</span>
        </div>
      </section>

      <!-- Filter Controls -->
      <section class="returns-controls">
        <div class="returns-tabs">
          <button
            type="button"
            class="returns-tab"
            [class.returns-tab--active]="activeStatusTab() === 'ALL'"
            (click)="setStatusTab('ALL')"
          >
            Todas ({{ kpis().total }})
          </button>
          <button
            type="button"
            class="returns-tab"
            [class.returns-tab--active]="activeStatusTab() === 'ENVIADO'"
            (click)="setStatusTab('ENVIADO')"
          >
            Enviadas ({{ kpis().enviadas }})
          </button>
          <button
            type="button"
            class="returns-tab"
            [class.returns-tab--active]="activeStatusTab() === 'PENDIENTE'"
            (click)="setStatusTab('PENDIENTE')"
          >
            Pendientes ({{ kpis().pendientes }})
          </button>
          <button
            type="button"
            class="returns-tab"
            [class.returns-tab--active]="activeStatusTab() === 'FALLIDO'"
            (click)="setStatusTab('FALLIDO')"
          >
            Fallidas ({{ kpis().fallidas }})
          </button>
        </div>

        <div class="returns-filters">
          <div class="returns-filter-group">
            <label for="notif-type-select">Tipo</label>
            <select
              id="notif-type-select"
              [value]="typeFilter()"
              (change)="onTypeFilterChange($event)"
            >
              <option value="">Todos los tipos</option>
              <option value="PEDIDOS">Pedidos</option>
              <option value="RESERVAS">Reservas</option>
              <option value="DEVOLUCIONES">Devoluciones</option>
              <option value="AVISOS">Avisos manuales</option>
            </select>
          </div>

          <div class="returns-filter-group">
            <label for="notif-channel-select">Canal</label>
            <select
              id="notif-channel-select"
              [value]="channelFilter()"
              (change)="onChannelFilterChange($event)"
            >
              <option value="">Todos los canales</option>
              <option value="EMAIL">Email</option>
              <option value="SISTEMA">Sistema</option>
            </select>
          </div>

          <div class="returns-search-wrapper">
            <label for="notif-search-input">Buscar</label>
            <input
              id="notif-search-input"
              type="text"
              placeholder="Cliente, correo, título o contenido..."
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
            />
          </div>
        </div>
      </section>

      <!-- Loading State -->
      @if (loading()) {
        <div class="admin-loading-state">
          <div class="spinner"></div>
          <p>Cargando registro de notificaciones...</p>
        </div>
      }

      <!-- Empty State -->
      @if (!loading() && notifications().length === 0) {
        <div class="returns-empty-state">
          <div class="returns-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </div>
          <h3>No se encontraron notificaciones</h3>
          <p>No existen registros que coincidan con los filtros aplicados en este momento.</p>
        </div>
      }

      <!-- Structured Table Layout -->
      @if (!loading() && notifications().length > 0) {
        <div class="returns-table-card">
          <div class="returns-table-wrapper">
            <table class="returns-table" aria-label="Listado de notificaciones operativas">
              <thead>
                <tr>
                  <th scope="col" style="width: 130px;">N° / Fecha</th>
                  <th scope="col" style="width: 220px;">Destinatario</th>
                  <th scope="col" style="width: 140px;">Tipo</th>
                  <th scope="col" style="width: 100px;">Canal</th>
                  <th scope="col">Mensaje</th>
                  <th scope="col" style="width: 120px;">Estado</th>
                  <th scope="col" style="width: 130px; text-align: right;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (item of notifications(); track item.id_notificacion) {
                  <tr class="returns-row">
                    <!-- N° / Fecha -->
                    <td>
                      <div class="returns-col-id">
                        <strong class="return-id">#{{ item.id_notificacion }}</strong>
                        <span class="return-date">{{ item.fecha_creacion | date: 'dd/MM/yyyy HH:mm' }}</span>
                      </div>
                    </td>

                    <!-- Destinatario -->
                    <td>
                      <div class="returns-col-requester">
                        <strong class="requester-name">{{ item.destinatario_nombre || 'Usuario #' + (item.id_usuario || 'S/D') }}</strong>
                        <span class="requester-sub">{{ item.destinatario_email || item.destinatario || 'Sin correo' }}</span>
                      </div>
                    </td>

                    <!-- Tipo -->
                    <td>
                      <span class="notif-type-tag" [ngClass]="getTypeBadgeClass(item.tipo)">
                        {{ formatTypeLabel(item.tipo) }}
                      </span>
                    </td>

                    <!-- Canal -->
                    <td>
                      <span class="channel-badge" [class.channel-badge--email]="item.canal === 'EMAIL'">
                        {{ item.canal }}
                      </span>
                    </td>

                    <!-- Mensaje -->
                    <td>
                      <div class="notif-msg-cell">
                        <strong class="notif-msg-title">{{ item.titulo || 'Actualización Operativa' }}</strong>
                        <p class="notif-msg-snippet">{{ item.contenido }}</p>
                      </div>
                    </td>

                    <!-- Estado -->
                    <td>
                      <span
                        class="returns-status-badge"
                        [class.returns-status-badge--success]="item.estado === 'ENVIADO'"
                        [class.returns-status-badge--warning]="item.estado === 'PENDIENTE'"
                        [class.returns-status-badge--danger]="item.estado === 'FALLIDO'"
                      >
                        <span class="badge-dot"></span>
                        {{ item.estado }}
                      </span>
                    </td>

                    <!-- Acciones -->
                    <td style="text-align: right;">
                      <div class="notif-actions">
                        <button
                          type="button"
                          class="button button--ghost button--small"
                          (click)="openDetailModal(item)"
                          title="Ver detalle de notificación"
                        >
                          Detalle
                        </button>
                        @if (item.estado === 'FALLIDO' || item.estado === 'PENDIENTE') {
                          <button
                            type="button"
                            class="button button--quiet button--small"
                            [disabled]="actionLoading() === item.id_notificacion"
                            (click)="resend(item)"
                            title="Reintentar despacho"
                          >
                            @if (actionLoading() === item.id_notificacion) {
                              Reintentando...
                            } @else {
                              Reenviar
                            }
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Compose Modal -->
      @if (showComposeModal()) {
        <div class="modal-backdrop" (click)="closeComposeModal()">
          <div class="modal-dialog modal-dialog--medium" (click)="$event.stopPropagation()">
            <header class="modal-header">
              <div>
                <h2>Nuevo Aviso Operativo</h2>
                <p>Envía un comunicado directo a la cuenta o correo de un cliente registrado.</p>
              </div>
              <button type="button" class="modal-close" (click)="closeComposeModal()" aria-label="Cerrar">✕</button>
            </header>

            <form [formGroup]="composeForm" (ngSubmit)="submitCompose()" class="modal-body">
              <div class="form-group">
                <label for="compose-customer">Cliente Destinatario *</label>
                <select id="compose-customer" formControlName="id_usuario">
                  <option value="">Selecciona un cliente...</option>
                  @for (c of customersList(); track c.id_cliente) {
                    <option [value]="c.id_usuario">
                      {{ c.nombres }} {{ c.apellidos }} ({{ c.correo }})
                    </option>
                  }
                </select>
                @if (composeForm.get('id_usuario')?.touched && composeForm.get('id_usuario')?.invalid) {
                  <p class="form-error">Debes seleccionar un cliente registrado.</p>
                }
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="compose-channel">Canal de Envío</label>
                  <select id="compose-channel" formControlName="canal">
                    <option value="SISTEMA">Notificación en Plataforma (Sistema)</option>
                    <option value="EMAIL">Correo Electrónico (Brevo)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="compose-type">Categoría Operativa</label>
                  <select id="compose-type" formControlName="tipo">
                    <option value="AVISO_OPERATIVO">Aviso General</option>
                    <option value="PEDIDO_AVISO">Actualización de Pedido / Logística</option>
                    <option value="RESERVA_AVISO">Aviso de Reserva / Probador</option>
                    <option value="DEVOLUCION_AVISO">Aviso de Devolución</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label for="compose-title">Asunto / Título *</label>
                <input
                  id="compose-title"
                  type="text"
                  placeholder="Ej. Demora estimada en entrega de pedido #12"
                  formControlName="titulo"
                />
                @if (composeForm.get('titulo')?.touched && composeForm.get('titulo')?.invalid) {
                  <p class="form-error">El asunto es requerido.</p>
                }
              </div>

              <div class="form-group">
                <label for="compose-content">Mensaje Operativo *</label>
                <textarea
                  id="compose-content"
                  rows="4"
                  placeholder="Escribe el mensaje claro y respetuoso para el cliente..."
                  formControlName="contenido"
                ></textarea>
                @if (composeForm.get('contenido')?.touched && composeForm.get('contenido')?.invalid) {
                  <p class="form-error">El contenido del mensaje es requerido.</p>
                }
              </div>

              <footer class="modal-footer">
                <button type="button" class="button button--ghost" (click)="closeComposeModal()">
                  Cancelar
                </button>
                <button
                  type="submit"
                  class="button button--primary"
                  [disabled]="composeForm.invalid || submittingCompose()"
                >
                  @if (submittingCompose()) {
                    Enviando aviso...
                  } @else {
                    Despachar Notificación
                  }
                </button>
              </footer>
            </form>
          </div>
        </div>
      }

      <!-- Detail Modal -->
      @if (selectedNotification()) {
        <div class="modal-backdrop" (click)="selectedNotification.set(null)">
          <div class="modal-dialog modal-dialog--medium" (click)="$event.stopPropagation()">
            <header class="modal-header">
              <div>
                <h2>Notificación #{{ selectedNotification()?.id_notificacion }}</h2>
                <p>Auditoría y trazabilidad del despacho operativo.</p>
              </div>
              <button type="button" class="modal-close" (click)="selectedNotification.set(null)" aria-label="Cerrar">✕</button>
            </header>

            <div class="modal-body notif-detail-grid">
              <div class="detail-field">
                <span class="detail-label">Destinatario</span>
                <strong class="detail-val">{{ selectedNotification()?.destinatario_nombre || 'N/D' }}</strong>
                <span class="detail-sub">{{ selectedNotification()?.destinatario_email || selectedNotification()?.destinatario }}</span>
              </div>

              <div class="detail-field">
                <span class="detail-label">Tipo y Canal</span>
                <div style="display: flex; gap: 8px; margin-top: 4px;">
                  <span class="notif-type-tag" [ngClass]="getTypeBadgeClass(selectedNotification()!.tipo)">
                    {{ formatTypeLabel(selectedNotification()!.tipo) }}
                  </span>
                  <span class="channel-badge">{{ selectedNotification()?.canal }}</span>
                </div>
              </div>

              <div class="detail-field">
                <span class="detail-label">Estado de Entrega</span>
                <span
                  class="returns-status-badge"
                  style="display: inline-flex; width: fit-content; margin-top: 4px;"
                  [class.returns-status-badge--success]="selectedNotification()?.estado === 'ENVIADO'"
                  [class.returns-status-badge--warning]="selectedNotification()?.estado === 'PENDIENTE'"
                  [class.returns-status-badge--danger]="selectedNotification()?.estado === 'FALLIDO'"
                >
                  <span class="badge-dot"></span>
                  {{ selectedNotification()?.estado }}
                </span>
              </div>

              <div class="detail-field">
                <span class="detail-label">Fecha de Registro</span>
                <strong class="detail-val">{{ selectedNotification()?.fecha_creacion | date: 'medium' }}</strong>
              </div>

              @if (selectedNotification()?.fecha_envio) {
                <div class="detail-field">
                  <span class="detail-label">Fecha de Despacho</span>
                  <strong class="detail-val">{{ selectedNotification()?.fecha_envio | date: 'medium' }}</strong>
                </div>
              }

              @if (selectedNotification()?.external_message_id) {
                <div class="detail-field">
                  <span class="detail-label">Message ID Externo</span>
                  <code class="detail-code">{{ selectedNotification()?.external_message_id }}</code>
                </div>
              }

              <div class="detail-field detail-field--full">
                <span class="detail-label">Título del Mensaje</span>
                <h4 style="margin: 4px 0 0; font-size: 16px;">{{ selectedNotification()?.titulo || 'Sin título' }}</h4>
              </div>

              <div class="detail-field detail-field--full">
                <span class="detail-label">Contenido</span>
                <div class="notif-detail-content">
                  {{ selectedNotification()?.contenido }}
                </div>
              </div>

              @if (selectedNotification()?.error_mensaje) {
                <div class="detail-field detail-field--full notif-detail-error">
                  <span class="detail-label" style="color: #b91c1c;">Detalle del Error Técnico</span>
                  <p style="margin: 4px 0 0; color: #b91c1c; font-size: 13px;">{{ selectedNotification()?.error_mensaje }}</p>
                </div>
              }
            </div>

            <footer class="modal-footer">
              @if (selectedNotification()?.estado === 'FALLIDO' || selectedNotification()?.estado === 'PENDIENTE') {
                <button
                  type="button"
                  class="button button--primary"
                  [disabled]="actionLoading() === selectedNotification()?.id_notificacion"
                  (click)="resend(selectedNotification()!)"
                >
                  Reintentar Envío Ahora
                </button>
              }
              <button type="button" class="button button--ghost" (click)="selectedNotification.set(null)">
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      }
    </div>
  `,
})
export class NotificationsAdmin implements OnInit {
  private readonly commerce = inject(CommerceService);
  private readonly errorService = inject(ApiErrorService);
  private readonly fb = inject(FormBuilder);

  readonly notifications = signal<AdminOperationalNotification[]>([]);
  readonly kpis = signal<NotificationKpis>({ total: 0, enviadas: 0, pendientes: 0, fallidas: 0 });
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly actionLoading = signal<number | null>(null);

  readonly activeStatusTab = signal<'ALL' | 'ENVIADO' | 'PENDIENTE' | 'FALLIDO'>('ALL');
  readonly typeFilter = signal('');
  readonly channelFilter = signal('');
  readonly searchQuery = signal('');

  readonly showComposeModal = signal(false);
  readonly submittingCompose = signal(false);
  readonly customersList = signal<CustomerAdminSummary[]>([]);
  readonly selectedNotification = signal<AdminOperationalNotification | null>(null);

  readonly composeForm = this.fb.group({
    id_usuario: ['', Validators.required],
    canal: ['SISTEMA', Validators.required],
    tipo: ['AVISO_OPERATIVO', Validators.required],
    titulo: ['', [Validators.required, Validators.maxLength(180)]],
    contenido: ['', [Validators.required, Validators.minLength(5)]],
  });

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.loading.set(true);
    const params: Record<string, string | number> = {
      page: 1,
      page_size: 50,
    };
    if (this.activeStatusTab() !== 'ALL') {
      params['estado'] = this.activeStatusTab();
    }
    if (this.typeFilter()) {
      params['tipo'] = this.typeFilter();
    }
    if (this.channelFilter()) {
      params['canal'] = this.channelFilter();
    }
    if (this.searchQuery().trim()) {
      params['search'] = this.searchQuery().trim();
    }

    this.commerce
      .adminNotifications(params)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.notifications.set(page.items);
          this.kpis.set(page.kpis);
        },
        error: (err) => this.errorMessage.set(this.errorService.message(err)),
      });
  }

  setStatusTab(tab: 'ALL' | 'ENVIADO' | 'PENDIENTE' | 'FALLIDO') {
    this.activeStatusTab.set(tab);
    this.loadNotifications();
  }

  onTypeFilterChange(e: Event) {
    this.typeFilter.set((e.target as HTMLSelectElement).value);
    this.loadNotifications();
  }

  onChannelFilterChange(e: Event) {
    this.channelFilter.set((e.target as HTMLSelectElement).value);
    this.loadNotifications();
  }

  onSearchInput(e: Event) {
    this.searchQuery.set((e.target as HTMLInputElement).value);
    this.loadNotifications();
  }

  openComposeModal() {
    this.composeForm.reset({
      id_usuario: '',
      canal: 'SISTEMA',
      tipo: 'AVISO_OPERATIVO',
      titulo: '',
      contenido: '',
    });
    this.showComposeModal.set(true);

    if (this.customersList().length === 0) {
      this.commerce.adminCustomers().subscribe({
        next: (customers) => this.customersList.set(customers),
      });
    }
  }

  closeComposeModal() {
    this.showComposeModal.set(false);
  }

  submitCompose() {
    if (this.composeForm.invalid) return;

    this.submittingCompose.set(true);
    const formVal = this.composeForm.value;

    this.commerce
      .sendManualNotification({
        id_usuario: Number(formVal.id_usuario),
        titulo: formVal.titulo!,
        contenido: formVal.contenido!,
        canal: formVal.canal as 'SISTEMA' | 'EMAIL',
        tipo: formVal.tipo!,
      })
      .pipe(finalize(() => this.submittingCompose.set(false)))
      .subscribe({
        next: (created) => {
          this.closeComposeModal();
          this.loadNotifications();
        },
        error: (err) => this.errorMessage.set(this.errorService.message(err)),
      });
  }

  openDetailModal(item: AdminOperationalNotification) {
    this.selectedNotification.set(item);
  }

  resend(item: AdminOperationalNotification) {
    this.actionLoading.set(item.id_notificacion);
    this.commerce
      .resendNotification(item.id_notificacion)
      .pipe(finalize(() => this.actionLoading.set(null)))
      .subscribe({
        next: (updated) => {
          this.loadNotifications();
          if (this.selectedNotification()?.id_notificacion === item.id_notificacion) {
            this.selectedNotification.set(updated);
          }
        },
        error: (err) => this.errorMessage.set(this.errorService.message(err)),
      });
  }

  formatTypeLabel(tipo: string): string {
    if (tipo.startsWith('PEDIDO_')) {
      return 'Pedido · ' + tipo.replace('PEDIDO_', '').toLowerCase();
    }
    if (tipo.startsWith('RESERVA_')) {
      return 'Reserva · ' + tipo.replace('RESERVA_', '').toLowerCase();
    }
    if (tipo.startsWith('DEVOLUCION_')) {
      return 'Devolución · ' + tipo.replace('DEVOLUCION_', '').toLowerCase();
    }
    if (tipo === 'PAGO_CONFIRMADO') {
      return 'Pago Confirmado';
    }
    if (tipo.includes('AVISO')) {
      return 'Aviso Directo';
    }
    return tipo;
  }

  getTypeBadgeClass(tipo: string): string {
    if (tipo.startsWith('PEDIDO_') || tipo === 'PAGO_CONFIRMADO') {
      return 'notif-type-tag--order';
    }
    if (tipo.startsWith('RESERVA_')) {
      return 'notif-type-tag--reservation';
    }
    if (tipo.startsWith('DEVOLUCION_')) {
      return 'notif-type-tag--return';
    }
    return 'notif-type-tag--notice';
  }
}
