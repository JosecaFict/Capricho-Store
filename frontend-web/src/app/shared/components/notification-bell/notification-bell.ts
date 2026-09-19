import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  OnInit,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { RouterLink } from '@angular/router';
import { OperationalNotification } from '../../../core/models/commerce.model';
import { CommerceService } from '../../../core/services/commerce.service';

@Component({
  selector: 'app-notification-bell',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="notification-bell-container" [class.is-open]="isOpen()">
      <button
        type="button"
        class="notification-bell-btn"
        (click)="toggle()"
        [attr.aria-expanded]="isOpen()"
        aria-label="Abrir centro de notificaciones"
        title="Notificaciones"
      >
        <svg
          class="bell-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        @if (unreadCount() > 0) {
          <span class="notification-badge" aria-label="{{ unreadCount() }} notificaciones recientes">
            {{ unreadCount() > 9 ? '9+' : unreadCount() }}
          </span>
        }
      </button>

      @if (isOpen()) {
        <div class="notification-dropdown" role="region" aria-label="Notificaciones recientes">
          <header class="notification-dropdown__header">
            <div class="dropdown-title-row">
              <h3>Notificaciones</h3>
              @if (unreadCount() > 0) {
                <span class="dropdown-count-pill">{{ unreadCount() }} pendientes</span>
              }
            </div>
            @if (unreadCount() > 0) {
              <button
                type="button"
                class="mark-all-read-btn"
                (click)="markAllAsRead()"
                title="Marcar todas como leídas"
              >
                Marcar todo leído
              </button>
            }
          </header>

          <div class="notification-dropdown__list">
            @if (loading() && items().length === 0) {
              <div class="dropdown-state-box">
                <span class="dropdown-spinner"></span>
                <p>Cargando avisos...</p>
              </div>
            } @else if (items().length === 0) {
              <div class="dropdown-state-box">
                <span class="empty-icon">🔔</span>
                <p><strong>Estás al día</strong></p>
                <small>No tienes notificaciones por el momento.</small>
              </div>
            } @else {
              @for (item of recentItems(); track item.id_notificacion) {
                <article
                  class="notification-item"
                  [class.is-unread]="item.estado !== 'LEIDO'"
                  [attr.data-type]="categorize(item.tipo)"
                  [routerLink]="itemRoute(item)"
                  (click)="onItemClick(item)"
                  style="cursor: pointer;"
                  title="Ir al detalle"
                >
                  <div class="notification-item__icon-wrap">
                    <span class="notification-item__icon">{{ iconFor(item.tipo) }}</span>
                  </div>
                  <div class="notification-item__content">
                    <div class="notification-item__top">
                      <span class="notification-item__badge">{{ badgeFor(item.tipo) }}</span>
                      <time [attr.datetime]="item.fecha_creacion">{{ formatRelative(item.fecha_creacion) }}</time>
                    </div>
                    <h4 class="notification-item__title">{{ item.titulo || 'Aviso de Capricho' }}</h4>
                    <p class="notification-item__body">{{ item.contenido }}</p>
                  </div>
                </article>
              }
            }
          </div>

          <footer class="notification-dropdown__footer">
            <a
              [routerLink]="destinationUrl()"
              (click)="close()"
              class="view-all-link"
            >
              Ver todas las notificaciones →
            </a>
          </footer>
        </div>
      }
    </div>
  `,
})
export class NotificationBell implements OnInit {
  private readonly commerce = inject(CommerceService);
  private readonly elementRef = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = input<'public' | 'admin'>('public');

  readonly isOpen = signal(false);
  readonly loading = signal(false);
  readonly items = signal<OperationalNotification[]>([]);

  readonly recentItems = computed(() => this.items().slice(0, 5));
  readonly unreadCount = computed(() =>
    this.items().filter((item) => item.estado !== 'LEIDO').length
  );

  readonly destinationUrl = computed(() =>
    this.mode() === 'admin' ? '/admin/notificaciones' : '/notificaciones',
  );

  ngOnInit(): void {
    this.loadNotifications();
    // Sondeo periódico en vivo cada 5 segundos
    timer(5000, 5000)
      .pipe(
        switchMap(() => this.commerce.notifications()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (list) => {
          this.items.set(list || []);
        },
        error: () => {},
      });
  }

  toggle(): void {
    const next = !this.isOpen();
    this.isOpen.set(next);
    if (next) {
      this.loadNotifications();
    }
  }

  close(): void {
    this.isOpen.set(false);
  }

  onItemClick(item: OperationalNotification): void {
    this.close();
    if (item.estado !== 'LEIDO') {
      this.items.update((list) =>
        list.map((n) =>
          n.id_notificacion === item.id_notificacion
            ? { ...n, estado: 'LEIDO' }
            : n
        )
      );
      this.commerce.markNotificationAsRead(item.id_notificacion).subscribe({
        next: () => {},
        error: () => {},
      });
    }
  }

  markAllAsRead(): void {
    this.items.update((list) =>
      list.map((n) => ({ ...n, estado: 'LEIDO' }))
    );
    this.commerce.markAllNotificationsAsRead().subscribe({
      next: () => {},
      error: () => {},
    });
  }

  loadNotifications(): void {
    this.loading.set(true);
    this.commerce.notifications().subscribe({
      next: (list) => {
        this.items.set(list || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  itemRoute(item: OperationalNotification): string {
    const t = (item.tipo || '').toUpperCase();
    if (this.mode() === 'admin') {
      if (t.includes('PEDIDO') || t.includes('VENTA') || t.includes('COMPRA')) return '/admin/pedidos';
      if (t.includes('RESERVA')) return '/admin/reservas';
      if (t.includes('STOCK') || t.includes('INVENTARIO')) return '/admin/inventario';
      if (t.includes('DEVOLUCION')) return '/admin/devoluciones';
      return '/admin/notificaciones';
    } else {
      if (
        t.includes('PEDIDO') ||
        t.includes('PAGO') ||
        t.includes('COMPRA') ||
        t.includes('VENTA') ||
        t.includes('DELIVERY') ||
        t.includes('ENTREGA') ||
        t.includes('ENVIO')
      ) {
        return '/pedidos';
      }
      if (t.includes('RESERVA')) return '/reservas';
      if (t.includes('DIRECCION') || t.includes('UBICACION')) return '/direcciones';
      if (t.includes('CATALOGO') || t.includes('PROMO') || t.includes('DESCUENTO') || t.includes('CAMPAÑA')) return '/catalogo';
      return '/notificaciones';
    }
  }

  categorize(tipo: string): string {
    const t = (tipo || '').toUpperCase();
    if (t.includes('NUEVO_PEDIDO')) return 'nuevo_pedido';
    if (t.includes('STOCK')) return 'stock';
    if (t.includes('PAGO') || t.includes('COMPRA')) return 'pago';
    if (t.includes('PEDIDO') || t.includes('CAMINO') || t.includes('ENTREGA')) return 'delivery';
    if (t.includes('RESERVA')) return 'reserva';
    if (t.includes('DEVOLUCION')) return 'devolucion';
    if (t.includes('CAMPAÑA') || t.includes('PROMOCIONAL')) return 'campania';
    return 'general';
  }

  iconFor(tipo: string): string {
    const cat = this.categorize(tipo);
    switch (cat) {
      case 'nuevo_pedido':
        return '🛍️';
      case 'stock':
        return '⚠️';
      case 'pago':
        return '💳';
      case 'delivery':
        return '🛵';
      case 'reserva':
        return '📋';
      case 'devolucion':
        return '🔄';
      case 'campania':
        return '📢';
      default:
        return '✨';
    }
  }

  badgeFor(tipo: string): string {
    const cat = this.categorize(tipo);
    switch (cat) {
      case 'nuevo_pedido':
        return 'Nuevo Pedido';
      case 'stock':
        return 'Stock Crítico';
      case 'pago':
        return 'Compra Confirmada';
      case 'delivery':
        return 'Delivery';
      case 'reserva':
        return 'Reserva';
      case 'devolucion':
        return 'Devolución';
      case 'campania':
        return 'Campaña';
      default:
        return 'Aviso';
    }
  }

  formatRelative(dateStr: string): string {
    if (!dateStr) return '';
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Hace un momento';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Hace ${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return new Date(dateStr).toLocaleDateString('es-BO', { month: 'short', day: 'numeric' });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) {
      this.close();
    }
  }
}
