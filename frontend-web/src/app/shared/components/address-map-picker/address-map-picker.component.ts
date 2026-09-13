import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  PLATFORM_ID,
  signal,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';

const customerPinIcon = L.divIcon({
  className: 'customer-map-pin',
  html: `
    <div style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35)); cursor: pointer;">
      <svg width="34" height="42" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.37 0 0 5.37 0 12C0 19.5 12 30 12 30C12 30 24 19.5 24 12C24 5.37 18.63 0 12 0Z" fill="#ef4444"/>
        <circle cx="12" cy="11" r="5" fill="#ffffff"/>
      </svg>
    </div>
  `,
  iconSize: [34, 42],
  iconAnchor: [17, 42],
  popupAnchor: [0, -42],
});

@Component({
  selector: 'app-address-map-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="map-picker-root">
      <div class="map-picker-toolbar">
        <div class="map-search-bar">
          <input
            type="text"
            class="map-search-input"
            placeholder="Buscar calle, avenida o barrio en Santa Cruz..."
            [(ngModel)]="searchQuery"
            (keydown.enter)="searchAddress()"
          />
          <button
            type="button"
            class="map-btn map-btn--search"
            (click)="searchAddress()"
            [disabled]="searching() || !searchQuery.trim()"
            title="Buscar en el mapa"
          >
            {{ searching() ? 'Buscando…' : '🔍 Buscar' }}
          </button>
        </div>
        <button
          type="button"
          class="map-btn map-btn--gps"
          (click)="useCurrentLocation()"
          [disabled]="gettingLocation()"
          title="Detectar ubicación GPS"
        >
          {{ gettingLocation() ? 'Localizando…' : '📍 Usar mi ubicación actual' }}
        </button>
      </div>

      @if (statusMessage()) {
        <div
          class="map-status-pill"
          [class.map-status-pill--error]="isStatusError()"
          role="status"
        >
          {{ statusMessage() }}
        </div>
      }

      <div class="map-canvas-wrap">
        <div #mapContainer class="map-canvas"></div>
      </div>

      <div class="map-picker-footer">
        <div class="coords-display">
          @if (currentLat() !== null && currentLng() !== null) {
            <span class="coords-tag">
              📍 <strong>Ubicación fijada:</strong> Lat: {{ currentLat() | number: '1.4-6' }} · Lng: {{ currentLng() | number: '1.4-6' }}
            </span>
          } @else {
            <span class="coords-tag coords-tag--empty">
              ⚠️ Haz clic en el mapa o arrastra el PIN para marcar la puerta de tu entrega.
            </span>
          }
        </div>
        <small class="map-hint">
          💡 Puedes arrastrar el PIN rojo 📍 directamente a tu casa o hacer clic en la calle exacta.
        </small>
      </div>
    </div>
  `,
  styles: [
    `
      .map-picker-root {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 0.75rem;
      }
      .map-picker-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }
      .map-search-bar {
        display: flex;
        flex: 1;
        min-width: 260px;
        gap: 0.35rem;
      }
      .map-search-input {
        flex: 1;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #f8fafc;
        border-radius: 6px;
        padding: 0.45rem 0.75rem;
        font-size: 0.85rem;
      }
      .map-search-input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }
      .map-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.45rem 0.85rem;
        border-radius: 6px;
        font-size: 0.82rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        border: 1px solid transparent;
        white-space: nowrap;
      }
      .map-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .map-btn--search {
        background: #2563eb;
        color: #fff;
      }
      .map-btn--search:hover:not(:disabled) {
        background: #1d4ed8;
      }
      .map-btn--gps {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
        border-color: rgba(16, 185, 129, 0.3);
      }
      .map-btn--gps:hover:not(:disabled) {
        background: rgba(16, 185, 129, 0.25);
      }
      .map-status-pill {
        padding: 0.35rem 0.75rem;
        font-size: 0.8rem;
        border-radius: 6px;
        background: rgba(59, 130, 246, 0.12);
        color: #93c5fd;
        border: 1px solid rgba(59, 130, 246, 0.25);
      }
      .map-status-pill--error {
        background: rgba(239, 68, 68, 0.12);
        color: #fca5a5;
        border-color: rgba(239, 68, 68, 0.3);
      }
      .map-canvas-wrap {
        position: relative;
        width: 100%;
        height: 280px;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.12);
      }
      .map-canvas {
        width: 100%;
        height: 100%;
      }
      .map-picker-footer {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-top: 0.25rem;
      }
      .coords-tag {
        display: inline-block;
        font-size: 0.8rem;
        color: #94a3b8;
        background: rgba(255, 255, 255, 0.04);
        padding: 0.25rem 0.6rem;
        border-radius: 4px;
      }
      .coords-tag strong {
        color: #f1f5f9;
      }
      .coords-tag--empty {
        color: #fbbf24;
        background: rgba(245, 158, 11, 0.1);
      }
      .map-hint {
        font-size: 0.74rem;
        color: #64748b;
      }
    `,
  ],
})
export class AddressMapPickerComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  @Input() lat: number | null = null;
  @Input() lng: number | null = null;
  @Input() initialAddressText = '';

  @Output() locationSelected = new EventEmitter<{
    lat: number;
    lng: number;
    addressText?: string;
  }>();

  searchQuery = '';
  readonly searching = signal(false);
  readonly gettingLocation = signal(false);
  readonly statusMessage = signal('');
  readonly isStatusError = signal(false);
  readonly currentLat = signal<number | null>(null);
  readonly currentLng = signal<number | null>(null);

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.initMap(), 100);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['lat'] || changes['lng']) && this.map) {
      if (this.lat !== null && this.lng !== null) {
        this.setMarkerPosition(this.lat, this.lng, false);
      }
    }
  }

  ngOnDestroy(): void {
    this.destroyMap();
  }

  private initMap(): void {
    if (!this.mapContainer?.nativeElement) return;
    this.destroyMap();

    const hasCoords = this.lat !== null && this.lng !== null && !isNaN(this.lat) && !isNaN(this.lng);
    const initialCenter: [number, number] = hasCoords
      ? [this.lat!, this.lng!]
      : [-17.7833, -63.1821]; // Santa Cruz default center

    const initialZoom = hasCoords ? 16 : 13;

    try {
      this.map = L.map(this.mapContainer.nativeElement, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(this.map);

      this.marker = L.marker(initialCenter, {
        icon: customerPinIcon,
        draggable: true,
      }).addTo(this.map);

      if (hasCoords) {
        this.currentLat.set(this.lat);
        this.currentLng.set(this.lng);
      }

      this.marker.on('dragend', () => {
        if (!this.marker) return;
        const pos = this.marker.getLatLng();
        this.updatePosition(pos.lat, pos.lng, true);
      });

      this.map.on('click', (e: L.LeafletMouseEvent) => {
        this.updatePosition(e.latlng.lat, e.latlng.lng, true);
      });

      // Recalcular dimensiones si el contenedor tardó en mostrarse
      setTimeout(() => {
        this.map?.invalidateSize();
      }, 200);
    } catch {
      // Graceful fallback
    }
  }

  private setMarkerPosition(lat: number, lng: number, emit = true): void {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    this.currentLat.set(latNum);
    this.currentLng.set(lngNum);

    if (this.marker) {
      this.marker.setLatLng([latNum, lngNum]);
    }
    if (this.map) {
      this.map.setView([latNum, lngNum], 16, { animate: true });
    }

    if (emit) {
      this.locationSelected.emit({ lat: latNum, lng: lngNum });
    }
  }

  private updatePosition(lat: number, lng: number, reverseGeocode = false): void {
    const roundedLat = Math.round(lat * 1e6) / 1e6;
    const roundedLng = Math.round(lng * 1e6) / 1e6;

    this.setMarkerPosition(roundedLat, roundedLng, true);

    if (reverseGeocode) {
      this.fetchAddressName(roundedLat, roundedLng);
    }
  }

  private async fetchAddressName(lat: number, lng: number): Promise<void> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.display_name) {
        const road = data.address?.road || data.address?.suburb || '';
        const houseNumber = data.address?.house_number ? ` #${data.address.house_number}` : '';
        const suburb = data.address?.neighbourhood || data.address?.suburb || '';
        const simpleAddress = [road + houseNumber, suburb].filter(Boolean).join(', ') || data.display_name.split(',')[0];
        
        this.locationSelected.emit({
          lat,
          lng,
          addressText: simpleAddress,
        });
      }
    } catch {
      // Silent catch
    }
  }

  async searchAddress(): Promise<void> {
    const query = this.searchQuery.trim();
    if (!query) return;

    this.searching.set(true);
    this.statusMessage.set('Buscando ubicación en el mapa…');
    this.isStatusError.set(false);

    try {
      const fullQuery = query.toLowerCase().includes('santa cruz')
        ? query
        : `${query}, Santa Cruz de la Sierra, Bolivia`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1&countrycodes=bo`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
      const data = await res.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        this.updatePosition(lat, lng, false);
        this.statusMessage.set(`📍 Ubicación encontrada: ${data[0].display_name.split(',')[0]}`);
      } else {
        this.isStatusError.set(true);
        this.statusMessage.set('No encontramos esa dirección. Prueba con el nombre de la calle, avenida o barrio.');
      }
    } catch {
      this.isStatusError.set(true);
      this.statusMessage.set('Error al conectar con el servicio de búsqueda de mapas.');
    } finally {
      this.searching.set(false);
    }
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.isStatusError.set(true);
      this.statusMessage.set('Tu navegador no soporta geolocalización GPS.');
      return;
    }

    this.gettingLocation.set(true);
    this.statusMessage.set('Detectando coordenadas GPS…');
    this.isStatusError.set(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        this.updatePosition(lat, lng, true);
        this.statusMessage.set('📍 Ubicación GPS detectada con éxito. Ajusta el pin si es necesario.');
        this.gettingLocation.set(false);
      },
      () => {
        this.isStatusError.set(true);
        this.statusMessage.set('No pudimos obtener tu ubicación GPS. Permite el acceso a ubicación en tu navegador.');
        this.gettingLocation.set(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  private destroyMap(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.marker = null;
    }
  }
}
