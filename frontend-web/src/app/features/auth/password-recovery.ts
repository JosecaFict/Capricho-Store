import { Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import {
  matchingPasswordsValidator,
  PasswordField,
  strongPasswordValidator,
} from './password-field';

type RecoveryStep = 'email' | 'otp' | 'password' | 'complete';

@Component({
  selector: 'app-password-recovery',
  imports: [ReactiveFormsModule, RouterLink, PasswordField],
  template: `
    <section class="auth-page auth-page--recovery">
      <div class="auth-visual" aria-hidden="true">
        <img src="/images/acceso-hombre-polo.jpg" alt="" />
      </div>
      <div class="auth-panel">
        <a class="back-link" routerLink="/login">Volver a iniciar sesión</a>

        @if (step() === 'email') {
          <h1 #stepHeading tabindex="-1">Recupera tu acceso</h1>
          <p>Te enviaremos un código de seis dígitos al correo registrado.</p>
          @if (errorMessage()) {
            <div class="notice notice--error" role="alert">{{ errorMessage() }}</div>
          }
          <form class="form-stack" [formGroup]="emailForm" (ngSubmit)="requestCode()" novalidate>
            <div class="field">
              <label for="recovery-email">Correo electrónico</label>
              <input
                id="recovery-email"
                type="email"
                formControlName="correo"
                autocomplete="email"
                [attr.aria-invalid]="emailInvalid()"
                [attr.aria-describedby]="emailInvalid() ? 'recovery-email-error' : null"
              />
              @if (emailInvalid()) {
                <p class="field-error" id="recovery-email-error">
                  Ingresa un correo electrónico válido.
                </p>
              }
            </div>
            <button
              class="button button--primary button--full"
              type="submit"
              [disabled]="emailForm.invalid || submitting()"
            >
              {{ submitting() ? 'Enviando código…' : 'Enviar código' }}
            </button>
          </form>
        }

        @if (step() === 'otp') {
          <h1 #stepHeading tabindex="-1">Revisa tu correo</h1>
          <p>
            Escribe el código enviado a <strong>{{ emailForm.controls.correo.value }}</strong
            >. Vence en 10 minutos.
          </p>
          @if (statusMessage()) {
            <div class="notice notice--success" role="status">{{ statusMessage() }}</div>
          }
          @if (errorMessage()) {
            <div class="notice notice--error" role="alert">{{ errorMessage() }}</div>
          }
          <form class="form-stack" [formGroup]="otpForm" (ngSubmit)="verifyCode()" novalidate>
            <div class="field">
              <label for="recovery-code">Código de verificación</label>
              <input
                class="otp-input"
                id="recovery-code"
                formControlName="codigo"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                placeholder="000000"
                [attr.aria-invalid]="otpInvalid()"
                [attr.aria-describedby]="otpInvalid() ? 'recovery-code-error' : null"
              />
              @if (otpInvalid()) {
                <p class="field-error" id="recovery-code-error">
                  Ingresa los seis números del código.
                </p>
              }
            </div>
            <button
              class="button button--primary button--full"
              type="submit"
              [disabled]="otpForm.invalid || submitting()"
            >
              {{ submitting() ? 'Verificando…' : 'Verificar código' }}
            </button>
          </form>
          <div class="auth-secondary-actions">
            <button
              class="text-button"
              type="button"
              [disabled]="submitting()"
              (click)="requestCode()"
            >
              Reenviar código
            </button>
            <button
              class="text-button"
              type="button"
              [disabled]="submitting()"
              (click)="changeEmail()"
            >
              Cambiar correo
            </button>
          </div>
        }

        @if (step() === 'password') {
          <h1 #stepHeading tabindex="-1">Crea una nueva contraseña</h1>
          <p>Elige una clave distinta y difícil de adivinar.</p>
          @if (errorMessage()) {
            <div class="notice notice--error" role="alert">{{ errorMessage() }}</div>
          }
          <form
            class="form-stack"
            [formGroup]="passwordForm"
            (ngSubmit)="resetPassword()"
            novalidate
          >
            <app-password-field
              fieldId="recovery-password"
              label="Nueva contraseña"
              [control]="passwordForm.controls.password"
              [showRequirements]="true"
              [invalid]="passwordInvalid()"
              [errorText]="passwordInvalid() ? 'Cumple todos los requisitos indicados.' : ''"
            />
            <app-password-field
              fieldId="recovery-password-confirmation"
              label="Confirmar contraseña"
              [control]="passwordForm.controls.passwordConfirmation"
              [invalid]="confirmationInvalid()"
              [errorText]="confirmationInvalid() ? 'Las contraseñas deben coincidir.' : ''"
            />
            <button
              class="button button--primary button--full"
              type="submit"
              [disabled]="passwordForm.invalid || submitting()"
            >
              {{ submitting() ? 'Actualizando…' : 'Guardar nueva contraseña' }}
            </button>
          </form>
          <button
            class="text-button recovery-restart"
            type="button"
            [disabled]="submitting()"
            (click)="restartRecovery()"
          >
            Solicitar otro código
          </button>
        }

        @if (step() === 'complete') {
          <div class="recovery-complete" role="status">
            <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 24.5l7 7L36 15" /></svg>
            <h1 #stepHeading tabindex="-1">Contraseña actualizada</h1>
            <p>Ya puedes ingresar con tu nueva contraseña.</p>
            <a class="button button--primary button--full" routerLink="/login">Iniciar sesión</a>
          </div>
        }
      </div>
    </section>
  `,
})
export class PasswordRecovery {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly errors = inject(ApiErrorService);

  readonly step = signal<RecoveryStep>('email');
  readonly submitting = signal(false);
  readonly errorMessage = signal('');
  readonly statusMessage = signal('');
  readonly resetToken = signal('');
  readonly stepHeading = viewChild<ElementRef<HTMLElement>>('stepHeading');

  readonly emailForm = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
  });
  readonly otpForm = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });
  readonly passwordForm = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.maxLength(128), strongPasswordValidator]],
      passwordConfirmation: ['', Validators.required],
    },
    { validators: matchingPasswordsValidator },
  );

  constructor() {
    effect(() => {
      const currentStep = this.step();
      const heading = this.stepHeading();
      if (currentStep !== 'email' && heading) heading.nativeElement.focus();
    });
  }

  emailInvalid(): boolean {
    const control = this.emailForm.controls.correo;
    return control.invalid && (control.touched || this.emailForm.touched);
  }

  otpInvalid(): boolean {
    const control = this.otpForm.controls.codigo;
    return control.invalid && (control.touched || this.otpForm.touched);
  }

  passwordInvalid(): boolean {
    const control = this.passwordForm.controls.password;
    return control.invalid && (control.touched || this.passwordForm.touched);
  }

  confirmationInvalid(): boolean {
    const control = this.passwordForm.controls.passwordConfirmation;
    return (
      (control.invalid || this.passwordForm.hasError('passwordMismatch')) &&
      (control.touched || this.passwordForm.touched)
    );
  }

  requestCode(): void {
    this.emailForm.markAllAsTouched();
    if (this.emailForm.invalid || this.submitting()) return;
    this.beginRequest();
    this.auth
      .requestPasswordRecovery(this.emailForm.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          this.statusMessage.set(response.message);
          this.step.set('otp');
        },
        error: (error) =>
          this.errorMessage.set(this.errors.message(error, 'No pudimos enviar el código.')),
      });
  }

  verifyCode(): void {
    this.otpForm.markAllAsTouched();
    if (this.otpForm.invalid || this.submitting()) return;
    this.beginRequest();
    this.auth
      .verifyPasswordRecoveryCode({
        correo: this.emailForm.controls.correo.value,
        codigo: this.otpForm.controls.codigo.value,
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          this.resetToken.set(response.reset_token);
          this.step.set('password');
        },
        error: (error) =>
          this.errorMessage.set(this.errors.message(error, 'No pudimos verificar el código.')),
      });
  }

  resetPassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.submitting()) return;
    this.beginRequest();
    this.auth
      .resetPassword({
        reset_token: this.resetToken(),
        password: this.passwordForm.controls.password.value,
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.step.set('complete'),
        error: (error) =>
          this.errorMessage.set(this.errors.message(error, 'No pudimos actualizar la contraseña.')),
      });
  }

  changeEmail(): void {
    this.otpForm.reset();
    this.errorMessage.set('');
    this.statusMessage.set('');
    this.step.set('email');
  }

  restartRecovery(): void {
    this.otpForm.reset();
    this.passwordForm.reset();
    this.resetToken.set('');
    this.errorMessage.set('');
    this.statusMessage.set('');
    this.step.set('email');
  }

  private beginRequest(): void {
    this.submitting.set(true);
    this.errorMessage.set('');
    this.statusMessage.set('');
  }
}
