import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { RegisterRequest } from '../../core/models/auth.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import {
  matchingPasswordsValidator,
  PasswordField,
  strongPasswordValidator,
} from './password-field';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, PasswordField],
  template: `
    <section class="auth-page auth-page--register">
      <div class="auth-visual" aria-hidden="true">
        <img src="/images/acceso-mujer-blusa.jpg" alt="" />
      </div>
      <div class="auth-panel">
        <a class="back-link" routerLink="/">Volver al inicio</a>
        <h1>Crea tu cuenta</h1>
        <p>Completa tus datos. Teléfono y CI son opcionales.</p>
        @if (errorMessage()) {
          <div class="notice notice--error" role="alert">{{ errorMessage() }}</div>
        }
        <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label for="names">Nombres</label
            ><input
              id="names"
              formControlName="nombres"
              autocomplete="given-name"
              [attr.aria-invalid]="invalid('nombres')"
              [attr.aria-describedby]="invalid('nombres') ? 'names-error' : null"
            />
            @if (invalid('nombres')) {
              <p class="field-error" id="names-error">Ingresa tus nombres.</p>
            }
          </div>
          <div class="field">
            <label for="lastnames">Apellidos</label
            ><input
              id="lastnames"
              formControlName="apellidos"
              autocomplete="family-name"
              [attr.aria-invalid]="invalid('apellidos')"
              [attr.aria-describedby]="invalid('apellidos') ? 'lastnames-error' : null"
            />
            @if (invalid('apellidos')) {
              <p class="field-error" id="lastnames-error">Ingresa tus apellidos.</p>
            }
          </div>
          <div class="field field--wide">
            <label for="register-email">Correo electrónico</label
            ><input
              id="register-email"
              type="email"
              formControlName="correo"
              autocomplete="email"
              [attr.aria-invalid]="invalid('correo')"
              [attr.aria-describedby]="invalid('correo') ? 'register-email-error' : null"
            />
            @if (invalid('correo')) {
              <p class="field-error" id="register-email-error">
                Ingresa un correo electrónico válido.
              </p>
            }
          </div>
          <div class="field">
            <label for="phone">Teléfono <span>opcional</span></label
            ><input
              id="phone"
              type="tel"
              formControlName="telefono"
              autocomplete="tel"
              maxlength="30"
            />
          </div>
          <div class="field">
            <label for="ci">CI <span>opcional</span></label
            ><input id="ci" formControlName="ci" maxlength="30" />
          </div>
          <app-password-field
            class="field--wide"
            fieldId="register-password"
            label="Contraseña"
            [control]="form.controls.password"
            [showRequirements]="true"
            [invalid]="invalid('password')"
            [errorText]="invalid('password') ? 'Cumple todos los requisitos indicados.' : ''"
          />
          <app-password-field
            class="field--wide"
            fieldId="register-password-confirmation"
            label="Confirmar contraseña"
            [control]="form.controls.passwordConfirmation"
            [invalid]="confirmationInvalid()"
            [errorText]="confirmationInvalid() ? 'Las contraseñas deben coincidir.' : ''"
          />
          <button
            class="button button--primary button--full field--wide"
            type="submit"
            [disabled]="form.invalid || submitting()"
          >
            {{ submitting() ? 'Creando cuenta…' : 'Crear cuenta' }}
          </button>
        </form>
        <p class="auth-switch">¿Ya tienes cuenta? <a routerLink="/login">Ingresar</a></p>
      </div>
    </section>
  `,
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly errors = inject(ApiErrorService);
  private readonly router = inject(Router);
  readonly submitting = signal(false);
  readonly errorMessage = signal('');
  readonly form = this.fb.nonNullable.group(
    {
      nombres: ['', [Validators.required, Validators.maxLength(100)]],
      apellidos: ['', [Validators.required, Validators.maxLength(100)]],
      correo: ['', [Validators.required, Validators.email]],
      telefono: ['', Validators.maxLength(30)],
      ci: ['', Validators.maxLength(30)],
      password: ['', [Validators.required, Validators.maxLength(128), strongPasswordValidator]],
      passwordConfirmation: ['', Validators.required],
    },
    { validators: matchingPasswordsValidator },
  );

  invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.form.touched);
  }

  confirmationInvalid(): boolean {
    const confirmation = this.form.controls.passwordConfirmation;
    return (
      (confirmation.invalid || this.form.hasError('passwordMismatch')) &&
      (confirmation.touched || this.form.touched)
    );
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;
    const value = this.form.getRawValue();
    const payload: RegisterRequest = {
      nombres: value.nombres,
      apellidos: value.apellidos,
      correo: value.correo,
      password: value.password,
      telefono: value.telefono.trim() || null,
      ci: value.ci.trim() || null,
    };
    this.submitting.set(true);
    this.errorMessage.set('');
    this.auth
      .register(payload)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () =>
          void this.router.navigate(['/login'], { queryParams: { registro: 'completo' } }),
        error: (error) =>
          this.errorMessage.set(this.errors.message(error, 'No pudimos crear la cuenta.')),
      });
  }
}
