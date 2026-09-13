import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CommerceService } from '../../core/services/commerce.service';
import {
  CustomerAdminDetail,
  CustomerAdminSummary,
  CustomerAdminUpdateRequest,
} from '../../core/models/commerce.model';

@Component({
  selector: 'app-customers-admin',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="admin-page">
      <header class="admin-page-heading">
        <div>
          <p class="eyebrow">Ventas y pedidos</p>
          <h1>Clientes</h1>
          <p>Directorio de clientes registrados, historial de actividad y perfil de contacto.</p>
        </div>
        <div class="customer-stats-strip">
          <div class="stat-pill">
            <span class="stat-pill__label">Total</span>
            <strong class="stat-pill__val">{{ totalCustomers() }}</strong>
          </div>
          <div class="stat-pill stat-pill--active">
            <span class="stat-pill__label">Activos</span>
            <strong class="stat-pill__val">{{ activeCustomers() }}</strong>
          </div>
          <div class="stat-pill stat-pill--highlight">
            <span class="stat-pill__label">Con pedidos</span>
            <strong class="stat-pill__val">{{ withOrdersCount() }}</strong>
          </div>
        </div>
      </header>

      @if (message()) {
        <div class="notice" [class.notice--error]="isError()" role="status">
          {{ message() }}
        </div>
      }

      <div class="admin-filterbar customer-filterbar">
        <label class="field customer-search">
          <span>Buscar cliente</span>
          <input
            type="search"
            placeholder="Nombre, correo, CI o teléfono..."
            [value]="searchTerm()"
            (input)="searchTerm.set($any($event.target).value)"
          />
        </label>
        <label class="field">
          <span>Estado</span>
          <select [value]="statusFilter()" (change)="statusFilter.set($any($event.target).value)">
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos</option>
          </select>
        </label>
        <button class="button button--quiet refresh-btn" (click)="loadCustomers()" title="Actualizar lista">
          🔄 Refrescar
        </button>
      </div>

      @if (loading()) {
        <div class="admin-skeleton" aria-label="Cargando clientes..."></div>
      } @else {
        <div class="admin-table-wrap">
          <table class="customer-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Identificación y contacto</th>
                <th>Registro / Cumpleaños</th>
                <th>Actividad</th>
                <th>Estado</th>
                <th class="th-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (c of filteredCustomers(); track c.id_cliente) {
                <tr>
                  <td>
                    <div class="customer-cell-name">
                      <div class="customer-avatar" [attr.data-initial]="c.nombres.charAt(0)">
                        {{ c.nombres.charAt(0) }}{{ c.apellidos.charAt(0) }}
                      </div>
                      <div>
                        <strong>{{ c.nombre_completo }}</strong>
                        <small class="customer-subtext">{{ c.correo }}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="customer-meta-block">
                      <span class="meta-tag">
                        <strong>CI:</strong> {{ c.ci || 'Sin CI' }}
                      </span>
                      <span class="meta-tag">
                        <strong>Tel:</strong> {{ c.telefono || 'Sin teléfono' }}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div class="customer-meta-block">
                      <small class="customer-subtext">Reg: {{ c.created_at | date: 'dd/MM/yyyy' }}</small>
                      @if (c.fecha_nacimiento) {
                        <small class="customer-subtext">🎂 {{ c.fecha_nacimiento | date: 'dd/MM/yyyy' }}</small>
                      } @else {
                        <small class="customer-subtext text-muted">🎂 —</small>
                      }
                    </div>
                  </td>
                  <td>
                    <div class="activity-chips">
                      <span class="activity-chip" [class.activity-chip--has]="c.total_pedidos > 0">
                        📦 {{ c.total_pedidos }} {{ c.total_pedidos === 1 ? 'pedido' : 'pedidos' }}
                      </span>
                      <span class="activity-chip" [class.activity-chip--has]="c.total_reservas > 0">
                        🕒 {{ c.total_reservas }} {{ c.total_reservas === 1 ? 'reserva' : 'reservas' }}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      class="status-chip"
                      [class.status-chip--muted]="c.estado !== 'ACTIVO'"
                    >
                      ● {{ c.estado }}
                    </span>
                  </td>
                  <td class="admin-row-actions">
                    <button
                      type="button"
                      class="button button--quiet action-btn action-btn--view"
                      (click)="viewCustomer(c.id_cliente)"
                    >
                      Ver
                    </button>
                    <button
                      type="button"
                      class="button button--primary action-btn action-btn--edit"
                      (click)="editCustomer(c)"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="admin-empty-state">
                    No se encontraron clientes registrados con los filtros seleccionados.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Modal de Detalle de Cliente -->
      @if (showDetailModal() && selectedCustomer()) {
        <div class="admin-modal-backdrop" (click)="closeDetailModal()">
          <div
            class="admin-modal-card customer-detail-card"
            (click)="$event.stopPropagation()"
            role="dialog"
            aria-modal="true"
          >
            <header class="admin-modal-header">
              <div>
                <span class="admin-modal-kicker">Perfil de cliente #{{ selectedCustomer()!.id_cliente }}</span>
                <h2 class="admin-modal-title">{{ selectedCustomer()!.nombre_completo }}</h2>
                <p class="admin-modal-subtitle">{{ selectedCustomer()!.correo }}</p>
              </div>
              <button
                type="button"
                class="admin-modal-close"
                (click)="closeDetailModal()"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </header>

            <div class="admin-modal-body">
              <section class="detail-section">
                <h3>Información general</h3>
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="detail-label">Cédula de Identidad:</span>
                    <strong>{{ selectedCustomer()!.ci || 'No registrada' }}</strong>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Teléfono / WhatsApp:</span>
                    <strong>{{ selectedCustomer()!.telefono || 'No registrado' }}</strong>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Fecha de nacimiento:</span>
                    <strong>{{ (selectedCustomer()!.fecha_nacimiento | date: 'dd/MM/yyyy') || 'No registrada' }}</strong>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Estado de la cuenta:</span>
                    <span
                      class="status-chip"
                      [class.status-chip--muted]="selectedCustomer()!.estado !== 'ACTIVO'"
                    >
                      ● {{ selectedCustomer()!.estado }}
                    </span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Fecha de registro:</span>
                    <strong>{{ selectedCustomer()!.created_at | date: 'dd/MM/yyyy HH:mm' }}</strong>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Última actualización:</span>
                    <strong>{{ selectedCustomer()!.updated_at | date: 'dd/MM/yyyy HH:mm' }}</strong>
                  </div>
                </div>
              </section>

              <section class="detail-section">
                <h3>Resumen operativo</h3>
                <div class="activity-summary-cards">
                  <div class="summary-card">
                    <span class="summary-icon">📦</span>
                    <span class="summary-count">{{ selectedCustomer()!.total_pedidos }}</span>
                    <span class="summary-name">Pedidos realizados</span>
                  </div>
                  <div class="summary-card">
                    <span class="summary-icon">🕒</span>
                    <span class="summary-count">{{ selectedCustomer()!.total_reservas }}</span>
                    <span class="summary-name">Reservas registradas</span>
                  </div>
                  <div class="summary-card">
                    <span class="summary-icon">🛍️</span>
                    <span class="summary-count">{{ selectedCustomer()!.total_ventas }}</span>
                    <span class="summary-name">Ventas asociadas</span>
                  </div>
                </div>
              </section>

              <section class="detail-section">
                <h3>Direcciones registradas ({{ selectedCustomer()!.direcciones.length }})</h3>
                @if (selectedCustomer()!.direcciones.length) {
                  <div class="addresses-list">
                    @for (dir of selectedCustomer()!.direcciones; track dir.id_direccion) {
                      <div class="address-item-card" [class.address-item-card--primary]="dir.es_principal">
                        <div class="address-header">
                          <strong>{{ dir.alias || 'Dirección sin alias' }}</strong>
                          @if (dir.es_principal) {
                            <span class="badge-primary">Principal</span>
                          }
                        </div>
                        <p class="address-text">{{ dir.direccion }}</p>
                        <p class="address-meta">
                          <span>Zona: {{ dir.zona || 'N/A' }}</span>
                          <span>Ciudad: {{ dir.ciudad }} ({{ dir.departamento }})</span>
                        </p>
                        @if (dir.referencia) {
                          <p class="address-ref"><em>Ref:</em> {{ dir.referencia }}</p>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <p class="text-muted">El cliente no tiene direcciones de entrega registradas todavía.</p>
                }
              </section>
            </div>

            <footer class="admin-modal-footer">
              <button
                type="button"
                class="admin-modal-btn admin-modal-btn--secondary"
                (click)="closeDetailModal()"
              >
                Cerrar
              </button>
              <button
                type="button"
                class="admin-modal-btn admin-modal-btn--primary"
                (click)="editFromDetail()"
              >
                Editar cliente
              </button>
            </footer>
          </div>
        </div>
      }

      <!-- Modal de Edición de Cliente -->
      @if (showEditModal()) {
        <div class="admin-modal-backdrop" (click)="closeEditModal()">
          <div
            class="admin-modal-card customer-edit-card"
            (click)="$event.stopPropagation()"
            role="dialog"
            aria-modal="true"
          >
            <header class="admin-modal-header">
              <div>
                <span class="admin-modal-kicker">Gestión de cuenta</span>
                <h2 class="admin-modal-title">Editar cliente</h2>
                <p class="admin-modal-subtitle">Modifica los datos personales, de contacto y credenciales de acceso.</p>
              </div>
              <button
                type="button"
                class="admin-modal-close"
                (click)="closeEditModal()"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </header>

            <form [formGroup]="editForm" (ngSubmit)="saveCustomer()">
              <div class="admin-modal-body">
                @if (editError()) {
                  <div class="notice notice--error" role="alert">
                    {{ editError() }}
                  </div>
                }

                <div class="form-grid-2">
                  <label class="field">
                    <span>Nombres *</span>
                    <input type="text" formControlName="nombres" placeholder="Nombres del cliente" />
                    @if (editForm.get('nombres')?.invalid && editForm.get('nombres')?.touched) {
                      <small class="field-error">El nombre es obligatorio.</small>
                    }
                  </label>

                  <label class="field">
                    <span>Apellidos *</span>
                    <input type="text" formControlName="apellidos" placeholder="Apellidos del cliente" />
                    @if (editForm.get('apellidos')?.invalid && editForm.get('apellidos')?.touched) {
                      <small class="field-error">Los apellidos son obligatorios.</small>
                    }
                  </label>
                </div>

                <div class="form-grid-2">
                  <label class="field">
                    <span>Correo electrónico *</span>
                    <input type="email" formControlName="correo" placeholder="correo@ejemplo.com" />
                    @if (editForm.get('correo')?.invalid && editForm.get('correo')?.touched) {
                      <small class="field-error">Ingrese un correo electrónico válido.</small>
                    }
                  </label>

                  <label class="field">
                    <span>Cédula de Identidad (CI)</span>
                    <input type="text" formControlName="ci" placeholder="Ej. 8472910 SC" />
                  </label>
                </div>

                <div class="form-grid-2">
                  <label class="field">
                    <span>Teléfono / WhatsApp</span>
                    <input type="text" formControlName="telefono" placeholder="Ej. 70012345" />
                  </label>

                  <label class="field">
                    <span>Fecha de nacimiento</span>
                    <input type="date" formControlName="fecha_nacimiento" />
                  </label>
                </div>

                <div class="form-grid-2">
                  <label class="field">
                    <span>Estado de cuenta *</span>
                    <select formControlName="estado">
                      <option value="ACTIVO">ACTIVO (Habilitado)</option>
                      <option value="INACTIVO">INACTIVO (Suspendido / Deshabilitado)</option>
                    </select>
                  </label>
                </div>

                <div class="password-reset-section">
                  <div class="password-reset-header">
                    <h4>🔒 Reseteo de contraseña (Opcional)</h4>
                    <p class="text-muted">Si el cliente olvidó su contraseña, ingresa aquí una nueva clave de acceso.</p>
                  </div>
                  <label class="field">
                    <span>Nueva contraseña</span>
                    <input
                      type="password"
                      formControlName="nuevo_password"
                      placeholder="Dejar en blanco para mantener la clave actual"
                      autocomplete="new-password"
                    />
                    @if (editForm.get('nuevo_password')?.invalid && editForm.get('nuevo_password')?.touched) {
                      <small class="field-error">La contraseña debe tener mínimo 8 caracteres.</small>
                    }
                  </label>
                </div>
              </div>

              <footer class="admin-modal-footer">
                <button
                  type="button"
                  class="admin-modal-btn admin-modal-btn--secondary"
                  (click)="closeEditModal()"
                  [disabled]="saving()"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  class="admin-modal-btn admin-modal-btn--primary"
                  [disabled]="editForm.invalid || saving()"
                >
                  {{ saving() ? 'Guardando cambios…' : 'Guardar cambios' }}
                </button>
              </footer>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .customer-stats-strip {
        display: flex;
        gap: 0.75rem;
        align-items: center;
      }
      .stat-pill {
        display: flex;
        align-items: baseline;
        gap: 0.4rem;
        padding: 0.35rem 0.85rem;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 9999px;
        font-size: 0.82rem;
      }
      .stat-pill__label {
        color: #94a3b8;
        text-transform: uppercase;
        font-size: 0.7rem;
        letter-spacing: 0.04em;
      }
      .stat-pill__val {
        color: #f8fafc;
        font-weight: 700;
      }
      .stat-pill--active {
        border-color: rgba(34, 197, 94, 0.3);
        background: rgba(34, 197, 94, 0.08);
      }
      .stat-pill--active .stat-pill__val {
        color: #4ade80;
      }
      .stat-pill--highlight {
        border-color: rgba(59, 130, 246, 0.3);
        background: rgba(59, 130, 246, 0.08);
      }
      .stat-pill--highlight .stat-pill__val {
        color: #60a5fa;
      }

      .customer-filterbar {
        display: flex;
        gap: 1rem;
        align-items: flex-end;
        margin-bottom: 1.25rem;
      }
      .customer-search {
        flex: 1;
      }
      .refresh-btn {
        height: 38px;
        align-self: flex-end;
      }

      .customer-table {
        width: 100%;
        border-collapse: collapse;
      }
      .customer-cell-name {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .customer-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #3b82f6, #6366f1);
        color: #fff;
        font-weight: 700;
        font-size: 0.82rem;
        display: flex;
        align-items: center;
        justify-content: center;
        text-transform: uppercase;
        flex-shrink: 0;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
      }
      .customer-subtext {
        display: block;
        color: #94a3b8;
        font-size: 0.8rem;
        margin-top: 0.15rem;
      }
      .customer-meta-block {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .meta-tag {
        font-size: 0.82rem;
        color: #cbd5e1;
      }
      .meta-tag strong {
        color: #94a3b8;
        font-weight: 500;
      }

      .activity-chips {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .activity-chip {
        font-size: 0.76rem;
        color: #94a3b8;
        background: rgba(255, 255, 255, 0.04);
        padding: 0.18rem 0.55rem;
        border-radius: 6px;
        width: fit-content;
      }
      .activity-chip--has {
        color: #93c5fd;
        background: rgba(59, 130, 246, 0.12);
        font-weight: 500;
      }

      .th-actions {
        text-align: right;
      }
      .action-btn {
        padding: 0.35rem 0.75rem;
        font-size: 0.82rem;
        margin-left: 0.35rem;
      }
      .action-btn--view {
        background: rgba(255, 255, 255, 0.06);
      }

      /* Modals styling */
      .customer-detail-card,
      .customer-edit-card {
        max-width: 640px;
        width: 100%;
      }
      .detail-section {
        margin-bottom: 1.5rem;
        padding-bottom: 1.25rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .detail-section:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
      }
      .detail-section h3 {
        font-size: 0.95rem;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.85rem;
      }
      .detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.85rem;
      }
      .detail-item {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .detail-label {
        font-size: 0.76rem;
        color: #64748b;
        text-transform: uppercase;
      }

      .activity-summary-cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
      }
      .summary-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .summary-icon {
        font-size: 1.4rem;
        margin-bottom: 0.25rem;
      }
      .summary-count {
        font-size: 1.25rem;
        font-weight: 700;
        color: #f8fafc;
      }
      .summary-name {
        font-size: 0.72rem;
        color: #94a3b8;
        margin-top: 0.2rem;
      }

      .addresses-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .address-item-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 0.85rem;
      }
      .address-item-card--primary {
        border-color: rgba(59, 130, 246, 0.4);
        background: rgba(59, 130, 246, 0.05);
      }
      .address-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.35rem;
      }
      .badge-primary {
        background: #2563eb;
        color: #fff;
        font-size: 0.68rem;
        font-weight: 600;
        padding: 0.15rem 0.5rem;
        border-radius: 9999px;
        text-transform: uppercase;
      }
      .address-text {
        font-size: 0.88rem;
        color: #f8fafc;
        margin: 0 0 0.25rem 0;
      }
      .address-meta {
        font-size: 0.78rem;
        color: #94a3b8;
        margin: 0;
        display: flex;
        gap: 1rem;
      }
      .address-ref {
        font-size: 0.78rem;
        color: #cbd5e1;
        margin: 0.25rem 0 0 0;
      }

      .form-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 0.85rem;
      }
      @media (max-width: 600px) {
        .form-grid-2 {
          grid-template-columns: 1fr;
        }
      }
      .field-error {
        color: #ef4444;
        font-size: 0.76rem;
        margin-top: 0.25rem;
        display: block;
      }

      .password-reset-section {
        margin-top: 1.25rem;
        padding-top: 1.25rem;
        border-top: 1px dashed rgba(255, 255, 255, 0.12);
      }
      .password-reset-header h4 {
        margin: 0 0 0.2rem 0;
        font-size: 0.9rem;
        color: #fbbf24;
      }
      .password-reset-header p {
        margin: 0 0 0.75rem 0;
        font-size: 0.8rem;
      }
      .text-muted {
        color: #64748b;
      }
    `,
  ],
})
export class CustomersAdmin implements OnInit {
  private readonly commerce = inject(CommerceService);
  private readonly apiError = inject(ApiErrorService);
  private readonly fb = inject(FormBuilder);

  readonly customers = signal<CustomerAdminSummary[]>([]);
  readonly loading = signal<boolean>(true);
  readonly searchTerm = signal<string>('');
  readonly statusFilter = signal<string>('');
  readonly message = signal<string | null>(null);
  readonly isError = signal<boolean>(false);

  readonly selectedCustomer = signal<CustomerAdminDetail | null>(null);
  readonly showDetailModal = signal<boolean>(false);
  readonly showEditModal = signal<boolean>(false);
  readonly editingCustomerId = signal<number | null>(null);
  readonly saving = signal<boolean>(false);
  readonly editError = signal<string | null>(null);

  readonly editForm = this.fb.group({
    nombres: ['', [Validators.required]],
    apellidos: ['', [Validators.required]],
    correo: ['', [Validators.required, Validators.email]],
    telefono: [''],
    ci: [''],
    fecha_nacimiento: [''],
    estado: ['ACTIVO', [Validators.required]],
    nuevo_password: ['', [Validators.minLength(8)]],
  });

  readonly totalCustomers = computed(() => this.customers().length);
  readonly activeCustomers = computed(
    () => this.customers().filter((c) => c.estado === 'ACTIVO').length,
  );
  readonly withOrdersCount = computed(
    () => this.customers().filter((c) => c.total_pedidos > 0 || c.total_ventas > 0).length,
  );

  readonly filteredCustomers = computed(() => {
    let result = this.customers();
    const status = this.statusFilter();
    if (status) {
      result = result.filter((c) => c.estado === status);
    }
    const q = this.searchTerm().trim().toLowerCase();
    if (q) {
      result = result.filter(
        (c) =>
          c.nombre_completo.toLowerCase().includes(q) ||
          c.correo.toLowerCase().includes(q) ||
          (c.ci && c.ci.toLowerCase().includes(q)) ||
          (c.telefono && c.telefono.toLowerCase().includes(q)),
      );
    }
    return result;
  });

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.loading.set(true);
    this.message.set(null);
    this.commerce.adminCustomers().subscribe({
      next: (list) => {
        this.customers.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.isError.set(true);
        this.message.set(this.apiError.message(err, 'Error al cargar clientes.'));
        this.loading.set(false);
      },
    });
  }

  viewCustomer(customerId: number): void {
    this.commerce.adminCustomer(customerId).subscribe({
      next: (detail) => {
        this.selectedCustomer.set(detail);
        this.showDetailModal.set(true);
      },
      error: (err) => {
        this.isError.set(true);
        this.message.set(this.apiError.message(err, 'No se pudo obtener el detalle del cliente.'));
      },
    });
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.selectedCustomer.set(null);
  }

  editCustomer(customer: CustomerAdminSummary): void {
    this.editingCustomerId.set(customer.id_cliente);
    this.editError.set(null);
    this.editForm.reset({
      nombres: customer.nombres,
      apellidos: customer.apellidos,
      correo: customer.correo,
      telefono: customer.telefono || '',
      ci: customer.ci || '',
      fecha_nacimiento: customer.fecha_nacimiento ? String(customer.fecha_nacimiento).slice(0, 10) : '',
      estado: customer.estado as 'ACTIVO' | 'INACTIVO',
      nuevo_password: '',
    });
    this.showEditModal.set(true);
  }

  editFromDetail(): void {
    const detail = this.selectedCustomer();
    if (detail) {
      this.closeDetailModal();
      this.editCustomer(detail);
    }
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingCustomerId.set(null);
    this.editError.set(null);
    this.editForm.reset();
  }

  saveCustomer(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const id = this.editingCustomerId();
    if (!id) return;

    const raw = this.editForm.value;
    const payload: CustomerAdminUpdateRequest = {
      nombres: raw.nombres?.trim(),
      apellidos: raw.apellidos?.trim(),
      correo: raw.correo?.trim(),
      telefono: raw.telefono?.trim() || null,
      ci: raw.ci?.trim() || null,
      fecha_nacimiento: raw.fecha_nacimiento || null,
      estado: (raw.estado as 'ACTIVO' | 'INACTIVO') || 'ACTIVO',
    };

    if (raw.nuevo_password && raw.nuevo_password.trim().length >= 8) {
      payload.nuevo_password = raw.nuevo_password.trim();
    }

    this.saving.set(true);
    this.editError.set(null);

    this.commerce.updateAdminCustomer(id, payload).subscribe({
      next: (updatedDetail) => {
        this.saving.set(false);
        this.closeEditModal();
        this.isError.set(false);
        this.message.set(`Cliente "${updatedDetail.nombre_completo}" actualizado correctamente.`);

        // Actualizar en el signal local
        this.customers.update((prev) =>
          prev.map((c) => (c.id_cliente === updatedDetail.id_cliente ? updatedDetail : c)),
        );
      },
      error: (err) => {
        this.saving.set(false);
        this.editError.set(
          this.apiError.message(err, 'No se pudo actualizar el cliente. Verifique los datos.'),
        );
      },
    });
  }
}
