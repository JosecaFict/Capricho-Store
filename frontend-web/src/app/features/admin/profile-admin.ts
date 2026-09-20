import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ApiErrorService } from '../../core/services/api-error.service';

@Component({
  selector: 'app-profile-admin',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="admin-page admin-profile-page">
      <header class="admin-page-heading">
        <div>
          <p class="eyebrow">SEGURIDAD Y CUENTA</p>
          <h1>Mi Perfil y Credenciales</h1>
          <p>Gestiona tu información de contacto, credenciales de acceso y preferencias dentro del sistema operativo.</p>
        </div>
      </header>

      <!-- Tarjeta 1: Datos Personales y Operativos -->
      <section class="admin-profile-card">
        <header class="admin-profile-card__header">
          <div class="admin-profile-card__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <h2>Datos Personales</h2>
          </div>
          @if (!isEditingProfile()) {
            <button
              type="button"
              class="button button--secondary button--sm"
              (click)="startEditingProfile()"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" aria-hidden="true">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
              <span>Editar datos personales</span>
            </button>
          }
        </header>

        @if (profileNotice()) {
          <div
            class="notice"
            [class.notice--error]="isProfileError()"
            role="status"
          >
            {{ profileNotice() }}
          </div>
        }

        <div class="admin-profile-grid">
          <!-- Columna Izquierda: Identidad y Avatar -->
          <div class="admin-profile-identity">
            <div class="admin-profile-avatar-wrapper">
              <div class="admin-profile-identity__avatar" [class.has-image]="!!user()?.avatar_url" aria-hidden="true">
                @if (user()?.avatar_url) {
                  <img [src]="user()?.avatar_url" [alt]="user()?.nombres" class="admin-avatar-img" />
                } @else {
                  {{ userInitial() }}
                }
              </div>
              <label class="admin-avatar-action" title="Subir o cambiar foto de perfil" [class.is-loading]="uploadingAvatar()">
                @if (uploadingAvatar()) {
                  <span class="avatar-mini-spinner"></span>
                } @else {
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                    <circle cx="12" cy="13" r="3"/>
                  </svg>
                }
                <input type="file" accept="image/jpeg,image/png,image/webp" style="display:none;" (change)="onAvatarSelected($event)" [disabled]="uploadingAvatar()" />
              </label>
            </div>
            @if (user()?.avatar_url) {
              <button class="account-avatar-delete-link" type="button" (click)="deleteAvatar()" title="Eliminar foto actual">
                Quitar foto
              </button>
            }
            <div class="admin-profile-identity__badges">
              <span class="status-chip status-chip--active">{{ user()?.estado || 'ACTIVO' }}</span>
              <span class="role-chip">{{ roleLabel() }}</span>
            </div>
            <p class="admin-profile-identity__branch">
              <strong>Sucursal:</strong><br />
              {{ branchLabel() }}
            </p>
          </div>

          <!-- Columna Derecha: Campos de Información / Formulario -->
          <div class="admin-profile-fields">
            @if (!isEditingProfile()) {
              <!-- Modo Lectura -->
              <dl class="profile-info-grid">
                <div class="profile-info-item">
                  <dt>Nombres</dt>
                  <dd>{{ user()?.nombres || 'No registrado' }}</dd>
                </div>
                <div class="profile-info-item">
                  <dt>Apellidos</dt>
                  <dd>{{ user()?.apellidos || 'No registrado' }}</dd>
                </div>
                <div class="profile-info-item">
                  <dt>Correo electrónico</dt>
                  <dd class="profile-info-item__email">
                    <span>{{ user()?.correo }}</span>
                    <small>(Identificador único)</small>
                  </dd>
                </div>
                <div class="profile-info-item">
                  <dt>Teléfono</dt>
                  <dd>{{ user()?.telefono || 'No registrado' }}</dd>
                </div>
                <div class="profile-info-item">
                  <dt>Carnet de Identidad (CI)</dt>
                  <dd>{{ user()?.ci || 'No registrado' }}</dd>
                </div>
                <div class="profile-info-item">
                  <dt>Sucursal asignada</dt>
                  <dd>{{ branchLabel() }}</dd>
                </div>
              </dl>
            } @else {
              <!-- Modo Edición -->
              <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" class="profile-form">
                <div class="profile-form-row">
                  <label class="field">
                    <span>Nombres *</span>
                    <input
                      type="text"
                      formControlName="nombres"
                      placeholder="Tus nombres"
                      required
                    />
                  </label>
                  <label class="field">
                    <span>Apellidos *</span>
                    <input
                      type="text"
                      formControlName="apellidos"
                      placeholder="Tus apellidos"
                      required
                    />
                  </label>
                </div>

                <div class="profile-form-row">
                  <label class="field">
                    <span>Correo electrónico</span>
                    <input
                      type="email"
                      [value]="user()?.correo"
                      disabled
                      title="El correo no puede modificarse directamente"
                    />
                  </label>
                  <label class="field">
                    <span>Teléfono</span>
                    <input
                      type="tel"
                      formControlName="telefono"
                      placeholder="Ej. 78035692"
                    />
                  </label>
                </div>

                <div class="profile-form-row">
                  <label class="field">
                    <span>Carnet de Identidad (CI)</span>
                    <input
                      type="text"
                      formControlName="ci"
                      placeholder="Ej. 6339300"
                    />
                  </label>
                  <label class="field">
                    <span>Sucursal asignada</span>
                    <input
                      type="text"
                      [value]="branchLabel()"
                      disabled
                    />
                  </label>
                </div>

                <div class="profile-form-actions">
                  <button
                    type="submit"
                    class="button button--primary"
                    [disabled]="profileForm.invalid || savingProfile()"
                  >
                    @if (savingProfile()) {
                      <span class="btn-spinner" aria-hidden="true"></span>
                      <span>Guardando...</span>
                    } @else {
                      <span>Guardar cambios</span>
                    }
                  </button>
                  <button
                    type="button"
                    class="button button--secondary"
                    (click)="cancelEditingProfile()"
                    [disabled]="savingProfile()"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            }
          </div>
        </div>
      </section>

      <!-- Tarjeta 2: Seguridad y Cambio de Contraseña -->
      <section class="admin-profile-card">
        <header class="admin-profile-card__header">
          <div class="admin-profile-card__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h2>Seguridad y Contraseña</h2>
          </div>
        </header>

        <p class="admin-profile-card__subtitle">
          Actualiza tu clave de acceso para garantizar la protección de tus operaciones administrativas.
        </p>

        @if (passwordNotice()) {
          <div
            class="notice"
            [class.notice--error]="isPasswordError()"
            role="status"
          >
            {{ passwordNotice() }}
          </div>
        }

        <form [formGroup]="passwordForm" (ngSubmit)="savePassword()" class="password-form">
          <div class="password-form-fields">
            <!-- Contraseña Actual -->
            <label class="field">
              <span>Contraseña actual *</span>
              <div class="password-input-wrap">
                <input
                  [type]="showCurrentPassword() ? 'text' : 'password'"
                  formControlName="current_password"
                  placeholder="Ingresa tu contraseña actual"
                  required
                />
                <button
                  type="button"
                  class="password-toggle-btn"
                  (click)="showCurrentPassword.set(!showCurrentPassword())"
                  [title]="showCurrentPassword() ? 'Ocultar' : 'Mostrar'"
                  aria-label="Alternar visibilidad de contraseña actual"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
                    @if (showCurrentPassword()) {
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    } @else {
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    }
                  </svg>
                </button>
              </div>
            </label>

            <!-- Nueva Contraseña -->
            <label class="field">
              <span>Nueva contraseña *</span>
              <div class="password-input-wrap">
                <input
                  [type]="showNewPassword() ? 'text' : 'password'"
                  formControlName="new_password"
                  placeholder="Mínimo 8 caracteres"
                  required
                />
                <button
                  type="button"
                  class="password-toggle-btn"
                  (click)="showNewPassword.set(!showNewPassword())"
                  [title]="showNewPassword() ? 'Ocultar' : 'Mostrar'"
                  aria-label="Alternar visibilidad de nueva contraseña"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
                    @if (showNewPassword()) {
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    } @else {
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    }
                  </svg>
                </button>
              </div>
            </label>

            <!-- Confirmar Contraseña -->
            <label class="field">
              <span>Confirmar nueva contraseña *</span>
              <div class="password-input-wrap">
                <input
                  [type]="showConfirmPassword() ? 'text' : 'password'"
                  formControlName="confirm_password"
                  placeholder="Repite la nueva contraseña"
                  required
                />
                <button
                  type="button"
                  class="password-toggle-btn"
                  (click)="showConfirmPassword.set(!showConfirmPassword())"
                  [title]="showConfirmPassword() ? 'Ocultar' : 'Mostrar'"
                  aria-label="Alternar visibilidad de confirmación"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
                    @if (showConfirmPassword()) {
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    } @else {
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    }
                  </svg>
                </button>
              </div>
            </label>
          </div>

          <!-- Indicador de Requisitos -->
          <div class="password-requirements">
            <span class="req-title">Requisitos de seguridad:</span>
            <ul class="req-list">
              <li [class.is-valid]="hasMinLength()">Mínimo 8 caracteres</li>
              <li [class.is-valid]="hasLetters()">Al menos una mayúscula y una minúscula</li>
              <li [class.is-valid]="hasNumber()">Al menos un número</li>
              <li [class.is-valid]="passwordsMatch()">Las contraseñas coinciden</li>
            </ul>
          </div>

          <div class="password-form-actions">
            <button
              type="submit"
              class="button button--primary"
              [disabled]="!canSubmitPassword() || savingPassword()"
            >
              @if (savingPassword()) {
                <span class="btn-spinner" aria-hidden="true"></span>
                <span>Actualizando contraseña...</span>
              } @else {
                <span>Actualizar contraseña</span>
              }
            </button>
          </div>
        </form>
      </section>
    </div>
  `,
})
export class ProfileAdmin {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly apiError = inject(ApiErrorService);

  readonly user = this.auth.currentUser;
  readonly isEditingProfile = signal(false);
  readonly savingProfile = signal(false);
  readonly uploadingAvatar = signal(false);
  readonly profileNotice = signal<string | null>(null);
  readonly isProfileError = signal(false);

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
      this.isProfileError.set(true);
      this.profileNotice.set('La imagen supera el límite de 5 MB.');
      setTimeout(() => this.profileNotice.set(null), 5000);
      return;
    }
    this.uploadingAvatar.set(true);
    this.auth.uploadAvatar(file).subscribe({
      next: () => {
        this.uploadingAvatar.set(false);
        this.isProfileError.set(false);
        this.profileNotice.set('Foto de perfil actualizada con éxito.');
        setTimeout(() => this.profileNotice.set(null), 5000);
      },
      error: () => {
        this.uploadingAvatar.set(false);
        this.isProfileError.set(true);
        this.profileNotice.set('No se pudo subir la foto de perfil.');
        setTimeout(() => this.profileNotice.set(null), 5000);
      },
    });
    input.value = '';
  }

  deleteAvatar(): void {
    if (!window.confirm('¿Deseas eliminar tu foto de perfil actual?')) return;
    this.uploadingAvatar.set(true);
    this.auth.deleteAvatar().subscribe({
      next: () => {
        this.uploadingAvatar.set(false);
        this.isProfileError.set(false);
        this.profileNotice.set('Foto de perfil eliminada.');
        setTimeout(() => this.profileNotice.set(null), 4000);
      },
      error: () => {
        this.uploadingAvatar.set(false);
      },
    });
  }

  readonly showCurrentPassword = signal(false);
  readonly showNewPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly savingPassword = signal(false);
  readonly passwordNotice = signal<string | null>(null);
  readonly isPasswordError = signal(false);

  readonly roleLabel = computed(() => this.user()?.roles.join(' · ') || 'Sin rol asignado');
  readonly branchLabel = computed(() => {
    const user = this.user();
    if (user?.roles.includes('ADMIN')) return 'Todas las sucursales';
    return user?.sucursal ? `Sucursal asignada: ${user.sucursal}` : 'Sin sucursal asignada';
  });
  readonly userInitial = computed(() => {
    const name = this.user()?.nombres?.trim();
    return name ? name.charAt(0).toUpperCase() : 'U';
  });

  readonly profileForm = this.fb.group({
    nombres: ['', [Validators.required, Validators.minLength(1)]],
    apellidos: ['', [Validators.required, Validators.minLength(1)]],
    telefono: [''],
    ci: [''],
  });

  readonly passwordForm = this.fb.group({
    current_password: ['', [Validators.required, Validators.minLength(1)]],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', [Validators.required]],
  });

  readonly newPasswordValue = computed(() => this.passwordForm.get('new_password')?.value || '');
  readonly confirmPasswordValue = computed(() => this.passwordForm.get('confirm_password')?.value || '');

  hasMinLength(): boolean {
    const val = this.passwordForm.get('new_password')?.value || '';
    return val.length >= 8;
  }

  hasLetters(): boolean {
    const val = this.passwordForm.get('new_password')?.value || '';
    return /[a-z]/.test(val) && /[A-Z]/.test(val);
  }

  hasNumber(): boolean {
    const val = this.passwordForm.get('new_password')?.value || '';
    return /\d/.test(val);
  }

  passwordsMatch(): boolean {
    const p1 = this.passwordForm.get('new_password')?.value || '';
    const p2 = this.passwordForm.get('confirm_password')?.value || '';
    return p1.length > 0 && p1 === p2;
  }

  canSubmitPassword(): boolean {
    return (
      this.passwordForm.valid &&
      this.hasMinLength() &&
      this.hasLetters() &&
      this.hasNumber() &&
      this.passwordsMatch()
    );
  }

  startEditingProfile(): void {
    const current = this.user();
    this.profileForm.patchValue({
      nombres: current?.nombres || '',
      apellidos: current?.apellidos || '',
      telefono: current?.telefono || '',
      ci: current?.ci || '',
    });
    this.profileNotice.set(null);
    this.isEditingProfile.set(true);
  }

  cancelEditingProfile(): void {
    this.profileNotice.set(null);
    this.isEditingProfile.set(false);
  }

  saveProfile(): void {
    if (this.profileForm.invalid) return;

    this.savingProfile.set(true);
    this.profileNotice.set(null);

    const formVal = this.profileForm.getRawValue();
    this.auth
      .updateProfile({
        nombres: formVal.nombres?.trim() || '',
        apellidos: formVal.apellidos?.trim() || '',
        telefono: formVal.telefono?.trim() || null,
        ci: formVal.ci?.trim() || null,
      })
      .subscribe({
        next: () => {
          this.savingProfile.set(false);
          this.isEditingProfile.set(false);
          this.isProfileError.set(false);
          this.profileNotice.set('Tus datos personales se han actualizado correctamente.');
        },
        error: (err) => {
          this.savingProfile.set(false);
          this.isProfileError.set(true);
          this.profileNotice.set(this.apiError.message(err));
        },
      });
  }

  savePassword(): void {
    if (!this.canSubmitPassword()) return;

    this.savingPassword.set(true);
    this.passwordNotice.set(null);

    const formVal = this.passwordForm.getRawValue();
    this.auth
      .changePassword({
        current_password: formVal.current_password || '',
        new_password: formVal.new_password || '',
      })
      .subscribe({
        next: (res) => {
          this.savingPassword.set(false);
          this.isPasswordError.set(false);
          this.passwordNotice.set(res.message || 'Contraseña actualizada exitosamente.');
          this.passwordForm.reset();
        },
        error: (err) => {
          this.savingPassword.set(false);
          this.isPasswordError.set(true);
          this.passwordNotice.set(this.apiError.message(err));
        },
      });
  }
}
