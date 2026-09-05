import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { Register } from './register';

describe('Register', () => {
  it('enables account creation only when all data and both passwords are valid', () => {
    TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {} },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });
    const fixture = TestBed.createComponent(Register);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const submit = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;

    expect(submit.disabled).toBe(true);
    component.form.patchValue({
      nombres: 'Ana',
      apellidos: 'Pérez',
      correo: 'ana@example.com',
      password: 'ClaveSegura123!',
      passwordConfirmation: 'ClaveSegura123!',
    });
    fixture.detectChanges();

    expect(submit.disabled).toBe(false);
  });

  it('toggles password visibility with an accessible control', () => {
    TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {} },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });
    const fixture = TestBed.createComponent(Register);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#register-password') as HTMLInputElement;
    const toggle = fixture.nativeElement.querySelector('.password-visibility') as HTMLButtonElement;

    expect(input.type).toBe('password');
    expect(toggle.getAttribute('aria-label')).toBe('Mostrar contraseña');
    toggle.click();
    fixture.detectChanges();

    expect(input.type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Ocultar contraseña');
  });
});
