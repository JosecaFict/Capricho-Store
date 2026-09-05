import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { PasswordRecovery } from './password-recovery';

describe('PasswordRecovery', () => {
  it('moves through email, OTP, password and completion states', () => {
    const auth = {
      requestPasswordRecovery: vi.fn(() => of({ message: 'Código enviado' })),
      verifyPasswordRecoveryCode: vi.fn(() => of({ reset_token: 'reset-token', expires_in: 600 })),
      resetPassword: vi.fn(() => of({ message: 'Contraseña actualizada' })),
    };
    TestBed.configureTestingModule({
      imports: [PasswordRecovery],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ApiErrorService, useValue: { message: () => 'Error' } },
      ],
    });
    const fixture = TestBed.createComponent(PasswordRecovery);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.emailForm.setValue({ correo: 'ana@example.com' });
    component.requestCode();
    fixture.detectChanges();
    expect(component.step()).toBe('otp');
    expect(document.activeElement?.textContent).toContain('Revisa tu correo');

    component.otpForm.setValue({ codigo: '123456' });
    component.verifyCode();
    fixture.detectChanges();
    expect(component.step()).toBe('password');
    expect(document.activeElement?.textContent).toContain('Crea una nueva contraseña');

    component.passwordForm.setValue({
      password: 'NuevaClave123!',
      passwordConfirmation: 'NuevaClave123!',
    });
    component.resetPassword();
    fixture.detectChanges();

    expect(component.step()).toBe('complete');
    expect(auth.resetPassword).toHaveBeenCalledWith({
      reset_token: 'reset-token',
      password: 'NuevaClave123!',
    });
  });
});
