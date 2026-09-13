import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import * as L from 'leaflet';
import { finalize, forkJoin } from 'rxjs';
import { PermissionService } from '../../core/permissions/permission.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AdminApiService, Entity } from './admin-api.service';

const branchPinIcon = L.divIcon({
  className: 'branch-marker-wrapper',
  html: `
    <div class="branch-pin-bubble">
      <svg width="32" height="40" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.37 0 0 5.37 0 12C0 19.5 12 30 12 30C12 30 24 19.5 24 12C24 5.37 18.63 0 12 0Z" fill="#2563eb"/>
        <circle cx="12" cy="11" r="5" fill="#ffffff"/>
      </svg>
    </div>
  `,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -40],
});

function validSchedule(control: AbstractControl): ValidationErrors | null {
  const opening = control.get('hora_apertura')?.value;
  const closing = control.get('hora_cierre')?.value;
  if (Boolean(opening) !== Boolean(closing)) return { incompleteSchedule: true };
  return opening && closing && closing <= opening ? { invalidSchedule: true } : null;
}

@Component({
  selector: 'app-branches-admin',
  imports: [CommonModule, ReactiveFormsModule],
  template: `<div class="admin-page">
    <header class="admin-page-heading">
      <div>
        <h1>Sucursales</h1>
        <p>Ubicaciones que organizan empleados, compras, existencias y transferencias.</p>
      </div>
      @if (canCreate()) {
        <button class="button button--primary" type="button" (click)="openCreate()">
          Nueva sucursal
        </button>
      }
    </header>

    @if (message()) {
      <div
        class="notice"
        [class.notice--error]="isError()"
        [attr.role]="isError() ? 'alert' : 'status'"
      >
        {{ message() }}
      </div>
    }

    @if (loadError()) {
      <section class="admin-state admin-state--inline" role="alert">
        <h2>No pudimos cargar las sucursales</h2>
        <p>{{ loadError() }}</p>
        <button class="button button--secondary" type="button" (click)="load()">Reintentar</button>
      </section>
    }

    @if (showForm()) {
      <section class="admin-editor" aria-labelledby="branch-form-title">
        <header>
          <div>
            <h2 id="branch-form-title">
              {{ editingId() ? 'Editar sucursal' : 'Crear sucursal' }}
            </h2>
            <p class="admin-help">
              La ubicación quedará disponible para empleados y operaciones de inventario.
            </p>
          </div>
          <button class="button button--quiet" type="button" (click)="closeForm()">Cerrar</button>
        </header>

        <form [formGroup]="form" (ngSubmit)="save()" class="admin-form-grid">
          <label class="field">
            <span>Nombre</span>
            <input
              #branchName
              id="branch-name"
              formControlName="nombre"
              maxlength="120"
              autocomplete="organization"
              required
              [attr.aria-invalid]="fieldInvalid('nombre')"
              aria-describedby="branch-name-error"
            />
            @if (fieldInvalid('nombre')) {
              <small id="branch-name-error" class="field-error">Escribe el nombre.</small>
            }
          </label>
          <label class="field">
            <span>Ciudad</span>
            <select
              id="branch-city"
              formControlName="id_ciudad"
              (change)="onCityChange()"
              required
              [attr.aria-invalid]="fieldInvalid('id_ciudad')"
              aria-describedby="branch-city-error"
            >
              <option value="">Seleccionar ciudad</option>
              @for (city of cities(); track city['id_ciudad']) {
                <option [value]="city['id_ciudad']">
                  {{ city['nombre'] }} · {{ city['departamento'] }}
                </option>
              }
            </select>
            @if (fieldInvalid('id_ciudad')) {
              <small id="branch-city-error" class="field-error">Selecciona una ciudad.</small>
            }
          </label>
          <label class="field">
            <span>Teléfono</span>
            <input formControlName="telefono" maxlength="30" inputmode="tel" autocomplete="tel" />
          </label>
          <label class="field field--wide">
            <span>Dirección</span>
            <input
              id="branch-address"
              formControlName="direccion"
              maxlength="255"
              autocomplete="street-address"
              required
              [attr.aria-invalid]="fieldInvalid('direccion')"
              aria-describedby="branch-address-error"
            />
            @if (fieldInvalid('direccion')) {
              <small id="branch-address-error" class="field-error">Escribe la dirección.</small>
            }
          </label>
          <label class="field">
            <span>Hora de apertura</span>
            <input
              id="branch-opening"
              type="time"
              formControlName="hora_apertura"
              aria-describedby="branch-schedule-error"
            />
          </label>
          <label class="field">
            <span>Hora de cierre</span>
            <input
              id="branch-closing"
              type="time"
              formControlName="hora_cierre"
              aria-describedby="branch-schedule-error"
            />
          </label>
          <!-- Sección de Ubicación Geográfica con Mapa y Pin -->
          <div class="branch-map-section field--wide">
            <div class="branch-map-header">
              <div>
                <span class="branch-map-kicker">Georreferenciación (OpenRouteService & Envíos)</span>
                <strong class="branch-map-title">Ubicación exacta de la sucursal</strong>
                <p class="branch-map-help">
                  Haz clic en el mapa o arrastra el pin 📍 hasta la puerta del local para calcular rutas de delivery con precisión milimétrica.
                </p>
              </div>

              <!-- Botones de acción rápida para ubicar -->
              <div class="branch-map-actions">
                <button
                  type="button"
                  class="map-tool-btn"
                  (click)="searchAddressOnMap()"
                  [disabled]="searchingAddress() || !form.get('direccion')?.value"
                  title="Buscar en el mapa la dirección escrita arriba"
                >
                  @if (searchingAddress()) {
                    <span>Buscando…</span>
                  } @else {
                    <span>🔍 Buscar por dirección</span>
                  }
                </button>
                <button
                  type="button"
                  class="map-tool-btn map-tool-btn--gps"
                  (click)="detectCurrentLocation()"
                  [disabled]="detectingGps()"
                  title="Usar GPS del dispositivo actual"
                >
                  @if (detectingGps()) {
                    <span>Detectando GPS…</span>
                  } @else {
                    <span>📍 Mi ubicación GPS</span>
                  }
                </button>
              </div>
            </div>

            <!-- Contenedor del mapa Leaflet -->
            <div class="branch-map-canvas-wrap">
              <div id="branch-map-container" class="branch-map-canvas"></div>
              @if (mapStatusMessage()) {
                <div class="branch-map-status-pill" [class.branch-map-status-pill--error]="isMapStatusError()">
                  {{ mapStatusMessage() }}
                </div>
              }
            </div>

            <div class="branch-map-footer">
              <div class="branch-coords-display">
                <span class="coords-label">Coordenadas fijadas:</span>
                @if (form.get('latitud')?.value && form.get('longitud')?.value) {
                  <strong class="coords-value">
                    Lat: {{ form.get('latitud')?.value }} · Lng: {{ form.get('longitud')?.value }}
                  </strong>
                } @else {
                  <span class="coords-empty">Ningún punto fijado aún en el mapa</span>
                }
              </div>
              <small class="branch-hint-text">
                💡 Haz clic o arrastra el pin directamente a la calle o puerta de la sucursal.
              </small>
            </div>
          </div>

          <label class="field">
            <span>Latitud opcional</span>
            <input
              id="branch-latitude"
              type="number"
              step="0.000001"
              formControlName="latitud"
              (input)="onManualCoordChange()"
              [attr.aria-invalid]="fieldInvalid('latitud')"
              aria-describedby="branch-latitude-error"
            />
            @if (fieldInvalid('latitud')) {
              <small id="branch-latitude-error" class="field-error">
                Debe estar entre −90 y 90.
              </small>
            }
          </label>
          <label class="field">
            <span>Longitud opcional</span>
            <input
              id="branch-longitude"
              type="number"
              step="0.000001"
              formControlName="longitud"
              (input)="onManualCoordChange()"
              [attr.aria-invalid]="fieldInvalid('longitud')"
              aria-describedby="branch-longitude-error"
            />
            @if (fieldInvalid('longitud')) {
              <small id="branch-longitude-error" class="field-error">
                Debe estar entre −180 y 180.
              </small>
            }
          </label>
          <label class="field">
            <span>Google Place ID opcional</span>
            <input formControlName="place_id" maxlength="255" placeholder="Opcional (solo si usas Google)" />
          </label>
          <label class="check-field">
            <input type="checkbox" formControlName="activo" /> Sucursal activa
          </label>
          <div class="admin-form-actions">
            <button class="button button--primary" [disabled]="saving()">
              {{ saving() ? 'Guardando…' : editingId() ? 'Guardar cambios' : 'Crear sucursal' }}
            </button>
          </div>
          @if (form.hasError('invalidSchedule')) {
            <p id="branch-schedule-error" class="field-error field--wide" role="alert">
              La hora de cierre debe ser posterior a la hora de apertura.
            </p>
          }
          @if (form.hasError('incompleteSchedule')) {
            <p id="branch-schedule-error" class="field-error field--wide" role="alert">
              Completa ambas horas o deja las dos vacías.
            </p>
          }
        </form>
      </section>
    }

    @if (!loadError()) {
      <div
        class="admin-table-wrap"
        [attr.aria-busy]="loading()"
        tabindex="0"
        role="region"
        aria-label="Listado de sucursales; desplázate horizontalmente para ver todas las columnas"
      >
        <table>
          <thead>
            <tr>
              <th>Sucursal</th>
              <th>Ciudad</th>
              <th>Contacto</th>
              <th>Horario</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            @for (branch of branches(); track branch['id_sucursal']) {
              <tr>
                <td>
                  <strong>{{ branch['nombre'] }}</strong>
                  <small>{{ branch['direccion'] }}</small>
                </td>
                <td>
                  {{ branch['ciudad'] }}
                  <small>{{ branch['departamento'] }} · {{ branch['pais'] }}</small>
                </td>
                <td>{{ branch['telefono'] || 'Sin teléfono' }}</td>
                <td>{{ schedule(branch) }}</td>
                <td>
                  <span class="status-chip" [class.status-chip--muted]="!branch['activo']">
                    {{ branch['activo'] ? 'ACTIVA' : 'INACTIVA' }}
                  </span>
                </td>
                <td class="admin-row-actions">
                  @if (canEdit()) {
                    <button class="branch-action" type="button" (click)="edit(branch)">
                      Editar
                    </button>
                  } @else {
                    <span>Solo lectura</span>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="employee-empty">
                  <strong>{{
                    loading() ? 'Cargando sucursales…' : 'No hay sucursales registradas'
                  }}</strong>
                  @if (!loading()) {
                    <span>
                      {{
                        canCreate()
                          ? 'Crea la primera ubicación para comenzar a operar inventario.'
                          : 'No hay ubicaciones disponibles para tu cuenta.'
                      }}
                    </span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  </div>`,
  styles: `
    :host .admin-state--inline {
      margin-block: 2rem;
    }
    :host .branch-action {
      min-width: 44px;
      min-height: 44px;
    }
  `,
})
export class BranchesAdmin implements OnInit, OnDestroy {
  private readonly api = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly errors = inject(ApiErrorService);
  private readonly permissions = inject(PermissionService);

  readonly branches = signal<Entity[]>([]);
  readonly cities = signal<Entity[]>([]);
  readonly showForm = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly message = signal('');
  readonly isError = signal(false);
  readonly loadError = signal('');

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  readonly searchingAddress = signal(false);
  readonly detectingGps = signal(false);
  readonly mapStatusMessage = signal('');
  readonly isMapStatusError = signal(false);

  @ViewChild('branchName') private branchName?: ElementRef<HTMLInputElement>;
  private returnFocus: HTMLElement | null = null;

  readonly canCreate = () => this.permissions.has('sucursales.crear');
  readonly canEdit = () => this.permissions.has('sucursales.editar');

  readonly form = this.fb.group(
    {
      id_ciudad: [null as number | null, Validators.required],
      nombre: ['', [Validators.required, Validators.maxLength(120)]],
      direccion: ['', [Validators.required, Validators.maxLength(255)]],
      telefono: ['', Validators.maxLength(30)],
      hora_apertura: [''],
      hora_cierre: [''],
      latitud: [null as number | null, [Validators.min(-90), Validators.max(90)]],
      longitud: [null as number | null, [Validators.min(-180), Validators.max(180)]],
      place_id: ['', Validators.maxLength(255)],
      activo: [true],
    },
    { validators: validSchedule },
  );

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroyMap();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      branches: this.api.list('branches/admin'),
      cities: this.api.list('cities'),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ branches, cities }) => {
          this.branches.set(branches);
          this.cities.set(cities);
        },
        error: (error) => this.loadError.set(this.errors.message(error)),
      });
  }

  openCreate(): void {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.editingId.set(null);
    this.form.reset({ activo: true });
    this.submitted.set(false);
    this.showForm.set(true);
    this.clearMessage();
    this.mapStatusMessage.set('');
    this.focusForm();
    setTimeout(() => this.initMap(), 80);
  }

  edit(branch: Entity): void {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.editingId.set(Number(branch['id_sucursal']));
    this.form.reset({
      id_ciudad: branch['id_ciudad'],
      nombre: branch['nombre'],
      direccion: branch['direccion'],
      telefono: branch['telefono'] ?? '',
      hora_apertura: this.shortTime(branch['hora_apertura']),
      hora_cierre: this.shortTime(branch['hora_cierre']),
      latitud: branch['latitud'],
      longitud: branch['longitud'],
      place_id: branch['place_id'] ?? '',
      activo: branch['activo'],
    });
    this.submitted.set(false);
    this.showForm.set(true);
    this.clearMessage();
    this.mapStatusMessage.set('');
    window.scrollTo({ top: 0 });
    this.focusForm();
    setTimeout(() => this.initMap(), 80);
  }

  closeForm(): void {
    this.destroyMap();
    this.showForm.set(false);
    this.editingId.set(null);
    this.returnFocus?.focus();
    this.returnFocus = null;
  }

  private initMap(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const container = document.getElementById('branch-map-container');
    if (!container) return;

    this.destroyMap();

    try {
      const latVal = this.form.get('latitud')?.value;
      const lngVal = this.form.get('longitud')?.value;

      const hasCoords =
        latVal !== null &&
        lngVal !== null &&
        latVal !== undefined &&
        lngVal !== undefined &&
        !isNaN(Number(latVal)) &&
        !isNaN(Number(lngVal));

      const initialCenter: [number, number] = hasCoords
        ? [Number(latVal), Number(lngVal)]
        : [-17.7833, -63.1821]; // Santa Cruz default

      const initialZoom = hasCoords ? 16 : 13;

      this.map = L.map(container, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(this.map);

      if (hasCoords) {
        this.marker = L.marker(initialCenter, {
          icon: branchPinIcon,
          draggable: true,
        }).addTo(this.map);

        this.marker.on('dragend', () => {
          if (this.marker) {
            const pos = this.marker.getLatLng();
            this.setPinLocation(pos.lat, pos.lng);
          }
        });
      }

      this.map.on('click', (e: L.LeafletMouseEvent) => {
        this.setPinLocation(e.latlng.lat, e.latlng.lng);
      });

      setTimeout(() => {
        try {
          this.map?.invalidateSize();
        } catch {
          // ignore
        }
      }, 150);
    } catch (err) {
      console.warn('Map initialization skipped or failed:', err);
    }
  }

  private destroyMap(): void {
    if (this.map) {
      try {
        this.map.remove();
      } catch {
        // ignore
      }
      this.map = null;
      this.marker = null;
    }
  }

  setPinLocation(lat: number, lng: number, updateView = false): void {
    const latRounded = Number(lat.toFixed(6));
    const lngRounded = Number(lng.toFixed(6));

    this.form.patchValue({
      latitud: latRounded,
      longitud: lngRounded,
    });
    this.form.get('latitud')?.markAsDirty();
    this.form.get('longitud')?.markAsDirty();

    if (!this.marker && this.map) {
      this.marker = L.marker([latRounded, lngRounded], {
        icon: branchPinIcon,
        draggable: true,
      }).addTo(this.map);

      this.marker.on('dragend', () => {
        if (this.marker) {
          const pos = this.marker.getLatLng();
          this.setPinLocation(pos.lat, pos.lng);
        }
      });
    } else if (this.marker) {
      this.marker.setLatLng([latRounded, lngRounded]);
    }

    if (updateView && this.map) {
      this.map.setView([latRounded, lngRounded], 16);
    }

    this.mapStatusMessage.set(`📍 Pin fijado en: ${latRounded}, ${lngRounded}`);
    this.isMapStatusError.set(false);
  }

  onManualCoordChange(): void {
    const lat = Number(this.form.get('latitud')?.value);
    const lng = Number(this.form.get('longitud')?.value);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      if (this.marker && this.map) {
        this.marker.setLatLng([lat, lng]);
        this.map.panTo([lat, lng]);
      } else if (this.map) {
        this.setPinLocation(lat, lng, true);
      }
    }
  }

  onCityChange(): void {
    if (this.form.get('latitud')?.value || this.form.get('longitud')?.value) {
      return;
    }
    const cityId = this.form.get('id_ciudad')?.value;
    const cityObj = this.cities().find((c) => c['id_ciudad'] === cityId);
    if (!cityObj || !this.map) return;
    const name = String(cityObj['nombre']).toLowerCase();
    if (name.includes('santa cruz')) {
      this.map.setView([-17.7833, -63.1821], 13);
    } else if (name.includes('la paz')) {
      this.map.setView([-16.5000, -68.1500], 13);
    } else if (name.includes('cochabamba')) {
      this.map.setView([-17.3895, -66.1568], 13);
    }
  }

  searchAddressOnMap(): void {
    const address = this.form.get('direccion')?.value?.trim();
    if (!address) {
      this.mapStatusMessage.set('Escribe una dirección arriba para buscar.');
      this.isMapStatusError.set(true);
      return;
    }

    const cityId = this.form.get('id_ciudad')?.value;
    const cityObj = this.cities().find((c) => c['id_ciudad'] === cityId);
    const cityName = cityObj ? String(cityObj['nombre']) : 'Santa Cruz';

    const query = `${address}, ${cityName}, Bolivia`;
    this.searchingAddress.set(true);
    this.mapStatusMessage.set(`Buscando en OpenStreetMap: "${address}"…`);
    this.isMapStatusError.set(false);

    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=bo&q=${encodeURIComponent(query)}`,
    )
      .then((res) => res.json())
      .then((data: Array<{ lat: string; lon: string; display_name: string }>) => {
        this.searchingAddress.set(false);
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          this.setPinLocation(lat, lng, true);
          this.mapStatusMessage.set(`✓ Ubicación encontrada: ${data[0].display_name.slice(0, 55)}…`);
          this.isMapStatusError.set(false);
        } else {
          this.mapStatusMessage.set(
            'No se encontró la dirección exacta. Haz clic en el mapa para ubicar el pin.',
          );
          this.isMapStatusError.set(true);
        }
      })
      .catch(() => {
        this.searchingAddress.set(false);
        this.mapStatusMessage.set(
          'No se pudo conectar con el buscador. Haz clic en el mapa para colocar el pin.',
        );
        this.isMapStatusError.set(true);
      });
  }

  detectCurrentLocation(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.mapStatusMessage.set('Tu navegador no soporta geolocalización GPS.');
      this.isMapStatusError.set(true);
      return;
    }

    this.detectingGps.set(true);
    this.mapStatusMessage.set('Detectando coordenadas GPS del dispositivo…');
    this.isMapStatusError.set(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.detectingGps.set(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        this.setPinLocation(lat, lng, true);
        this.mapStatusMessage.set('✓ Coordenadas GPS obtenidas con éxito.');
        this.isMapStatusError.set(false);
      },
      (err) => {
        this.detectingGps.set(false);
        let msg = 'No pudimos obtener tu ubicación GPS.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Permiso de ubicación denegado por el navegador.';
        }
        this.mapStatusMessage.set(msg);
        this.isMapStatusError.set(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  save(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    const payload = {
      ...value,
      telefono: value.telefono?.trim() || null,
      place_id: value.place_id?.trim() || null,
      hora_apertura: value.hora_apertura || null,
      hora_cierre: value.hora_cierre || null,
    };
    const id = this.editingId();
    const request = id
      ? this.api.patch(`branches/${id}`, payload)
      : this.api.post('branches', payload);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.closeForm();
        this.ok(id ? 'Sucursal actualizada.' : 'Sucursal creada.');
        this.load();
      },
      error: (error) => this.fail(error),
    });
  }

  schedule(branch: Entity): string {
    const opening = this.shortTime(branch['hora_apertura']);
    const closing = this.shortTime(branch['hora_cierre']);
    return opening && closing ? `${opening}–${closing}` : 'Sin horario';
  }

  fieldInvalid(name: string): boolean {
    const field = this.form.get(name);
    return Boolean(field?.invalid && (field.touched || this.submitted()));
  }

  private shortTime(value: unknown): string {
    return typeof value === 'string' ? value.slice(0, 5) : '';
  }

  private focusForm(): void {
    requestAnimationFrame(() => this.branchName?.nativeElement.focus());
  }

  private ok(message: string): void {
    this.isError.set(false);
    this.message.set(message);
  }

  private fail(error: unknown): void {
    this.isError.set(true);
    this.message.set(this.errors.message(error));
  }

  private clearMessage(): void {
    this.isError.set(false);
    this.message.set('');
  }
}
