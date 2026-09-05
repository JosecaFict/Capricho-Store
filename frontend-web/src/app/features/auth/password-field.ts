import { Component, computed, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, ValidationErrors, ValidatorFn } from '@angular/forms';

export interface PasswordRequirement {
  label: string;
  met: boolean;
}

export function passwordRequirements(password: string): PasswordRequirement[] {
  return [
    { label: '8 caracteres como mínimo', met: password.length >= 8 },
    { label: 'Una letra mayúscula', met: /[A-ZÁÉÍÓÚÜÑ]/.test(password) },
    { label: 'Una letra minúscula', met: /[a-záéíóúüñ]/.test(password) },
    { label: 'Un número', met: /\d/.test(password) },
    { label: 'Un carácter especial', met: /[^\p{L}\p{N}\s]/u.test(password) },
  ];
}

export const strongPasswordValidator: ValidatorFn = (control): ValidationErrors | null =>
  passwordRequirements(String(control.value ?? '')).every((requirement) => requirement.met)
    ? null
    : { passwordStrength: true };

export const matchingPasswordsValidator: ValidatorFn = (control): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmation = control.get('passwordConfirmation')?.value;
  return password === confirmation ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-password-field',
  imports: [ReactiveFormsModule],
  template: `
    <div class="field">
      <label [for]="fieldId()">{{ label() }}</label>
      <div class="password-control">
        <input
          [id]="fieldId()"
          [type]="visible() ? 'text' : 'password'"
          [formControl]="control()"
          [autocomplete]="autocomplete()"
          [attr.aria-invalid]="invalid()"
          [attr.aria-describedby]="describedBy()"
        />
        <button
          class="password-visibility"
          type="button"
          [attr.aria-label]="visible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          [attr.aria-pressed]="visible()"
          (click)="visible.set(!visible())"
        >
          @if (visible()) {
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5.4 0 9 5.2 9 5.2a15.4 15.4 0 01-2.2 2.6M6.6 6.6A16.5 16.5 0 003 9.2S6.6 14.4 12 14.4c1 0 2-.2 2.8-.5"
              />
            </svg>
          } @else {
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 12s3.6-5.2 9-5.2 9 5.2 9 5.2-3.6 5.2-9 5.2S3 12 3 12z" />
              <circle cx="12" cy="12" r="2.2" />
            </svg>
          }
        </button>
      </div>
      @if (showRequirements()) {
        <ul
          class="password-requirements"
          [id]="requirementsId()"
          aria-label="Requisitos de contraseña"
        >
          @for (requirement of requirements(); track requirement.label) {
            <li [class.is-met]="requirement.met">
              <span aria-hidden="true"></span>{{ requirement.label }}
              <span class="visually-hidden">{{ requirement.met ? 'cumplido' : 'pendiente' }}</span>
            </li>
          }
        </ul>
      }
      @if (errorText()) {
        <p class="field-error" [id]="errorId()">{{ errorText() }}</p>
      }
    </div>
  `,
})
export class PasswordField {
  readonly control = input.required<FormControl<string>>();
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly autocomplete = input('new-password');
  readonly showRequirements = input(false);
  readonly invalid = input(false);
  readonly errorText = input('');
  readonly visible = signal(false);
  readonly requirementsId = computed(() => `${this.fieldId()}-requirements`);
  readonly errorId = computed(() => `${this.fieldId()}-error`);
  readonly describedBy = computed(() => {
    const ids: string[] = [];
    if (this.showRequirements()) ids.push(this.requirementsId());
    if (this.errorText()) ids.push(this.errorId());
    return ids.length ? ids.join(' ') : null;
  });

  requirements(): PasswordRequirement[] {
    return passwordRequirements(this.control().value);
  }
}
