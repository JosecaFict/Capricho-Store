import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiErrorService } from '../../core/services/api-error.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="auth-page">
      <div class="auth-visual" aria-hidden="true">
        <img src="/images/acceso-hombre-polo.jpg" alt="" />
      </div>
      <div class="auth-panel">
        <a class="back-link" routerLink="/">Volver al inicio</a>
        <h1>Bienvenido de nuevo</h1>
        <p>Ingresa para consultar tu cuenta de Capricho Store.</p>
        @if (registrationComplete()) {
          <div class="notice notice--success" role="status">
            Tu cuenta fue creada. Ya puedes ingresar.
          </div>
        }
        @if (sessionExpired()) {
          <div class="notice notice--warning" role="status">
            Tu sesión expiró. Ingresa nuevamente para continuar.
          </div>
        }
        @if (errorMessage()) {
          <div class="notice notice--error" role="alert">{{ errorMessage() }}</div>
        }
        <form class="form-stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label for="login-email">Correo electrónico</label>
            <input
              id="login-email"
              type="email"
              formControlName="correo"
              autocomplete="email"
              [attr.aria-invalid]="invalid('correo')"
            />
            @if (invalid('correo')) {
              <p class="field-error">Ingresa un correo electrónico válido.</p>
            }
          </div>
          <div class="field">
            <label for="login-password">Contraseña</label>
            <input
              id="login-password"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              [attr.aria-invalid]="invalid('password')"
            />
            @if (invalid('password')) {
              <p class="field-error">La contraseña es obligatoria.</p>
            }
          </div>
          <button
            class="button button--primary button--full"
            type="submit"
            [disabled]="submitting()"
          >
            {{ submitting() ? 'Ingresando…' : 'Ingresar' }}
          </button>
        </form>
        <p class="auth-switch">¿Aún no tienes cuenta? <a routerLink="/registro">Crear cuenta</a></p>
      </div>
    </section>
  `,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly errors = inject(ApiErrorService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly submitting = signal(false);
  readonly errorMessage = signal('');
  readonly sessionExpired = signal(this.route.snapshot.queryParamMap.get('sesion') === 'expirada');
  readonly registrationComplete = signal(
    this.route.snapshot.queryParamMap.get('registro') === 'completo',
  );
  readonly form = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  invalid(name: 'correo' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.form.touched);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set('');
    this.auth
      .login(this.form.getRawValue())
      .pipe(
        switchMap(() => this.auth.loadCurrentUser()),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: () =>
          void this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') ?? '/'),
        error: (error) =>
          this.errorMessage.set(this.errors.message(error, 'Correo o contraseña incorrectos.')),
      });
  }
}
