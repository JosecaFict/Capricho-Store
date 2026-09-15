import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { ProfileAdmin } from './profile-admin';

describe('ProfileAdmin', () => {
  function setup(userOverride = {}) {
    const userSignal = signal({
      id_usuario: 1,
      nombres: 'José Carlos',
      apellidos: 'Villarroel Dueñas',
      correo: 'huasi456@gmail.com',
      telefono: '78035692',
      ci: '6339300',
      estado: 'ACTIVO' as const,
      roles: ['ADMIN'],
      permisos: ['admin.total'],
      sucursal: 'CAPRICHO STORE CENTRAL',
      created_at: '2026-01-01',
      ...userOverride,
    });

    const authServiceMock = {
      currentUser: userSignal,
      updateProfile: vi.fn().mockReturnValue(
        of({
          ...userSignal(),
          nombres: 'José Carlos Modificado',
          telefono: '79998888',
        }),
      ),
      changePassword: vi.fn().mockReturnValue(
        of({
          message: 'Contraseña actualizada exitosamente',
        }),
      ),
    };

    const apiErrorMock = {
      message: vi.fn((err) => err?.message || 'Error inesperado'),
    };

    TestBed.configureTestingModule({
      imports: [ProfileAdmin],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: ApiErrorService, useValue: apiErrorMock },
      ],
    });

    const fixture = TestBed.createComponent(ProfileAdmin);
    fixture.detectChanges();

    return { fixture, component: fixture.componentInstance, authServiceMock, userSignal };
  }

  it('renders user details, status, role and branch in read mode', () => {
    const { fixture } = setup();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('José Carlos');
    expect(compiled.textContent).toContain('Villarroel Dueñas');
    expect(compiled.textContent).toContain('huasi456@gmail.com');
    expect(compiled.textContent).toContain('78035692');
    expect(compiled.textContent).toContain('6339300');
    expect(compiled.textContent).toContain('ADMIN');
    expect(compiled.textContent).toContain('Todas las sucursales');

    const avatarEl = fixture.debugElement.query(By.css('.admin-profile-identity__avatar'));
    expect(avatarEl.nativeElement.textContent.trim()).toBe('J');
  });

  it('toggles edit mode, updates profile and displays success notice', () => {
    const { fixture, component, authServiceMock } = setup();

    const editBtn = fixture.debugElement.query(By.css('button.button--secondary'));
    expect(editBtn).toBeTruthy();
    editBtn.nativeElement.click();
    fixture.detectChanges();

    expect(component.isEditingProfile()).toBe(true);

    component.profileForm.patchValue({
      nombres: 'José Carlos Modificado',
      apellidos: 'Villarroel Dueñas',
      telefono: '79998888',
      ci: '6339300',
    });

    component.saveProfile();
    fixture.detectChanges();

    expect(authServiceMock.updateProfile).toHaveBeenCalledWith({
      nombres: 'José Carlos Modificado',
      apellidos: 'Villarroel Dueñas',
      telefono: '79998888',
      ci: '6339300',
    });

    expect(component.isEditingProfile()).toBe(false);
    expect(component.profileNotice()).toContain('Tus datos personales se han actualizado correctamente');
  });

  it('validates password requirements and triggers changePassword upon submission', () => {
    const { fixture, component, authServiceMock } = setup();

    component.passwordForm.patchValue({
      current_password: 'OldPassword1!',
      new_password: 'NewSecurePassword2026!',
      confirm_password: 'NewSecurePassword2026!',
    });
    fixture.detectChanges();

    expect(component.hasMinLength()).toBe(true);
    expect(component.hasLetters()).toBe(true);
    expect(component.hasNumber()).toBe(true);
    expect(component.passwordsMatch()).toBe(true);
    expect(component.canSubmitPassword()).toBe(true);

    component.savePassword();
    fixture.detectChanges();

    expect(authServiceMock.changePassword).toHaveBeenCalledWith({
      current_password: 'OldPassword1!',
      new_password: 'NewSecurePassword2026!',
    });

    expect(component.passwordNotice()).toContain('Contraseña actualizada exitosamente');
  });

  it('prevents password submission when passwords do not match', () => {
    const { fixture, component, authServiceMock } = setup();

    component.passwordForm.patchValue({
      current_password: 'OldPassword1!',
      new_password: 'NewSecurePassword2026!',
      confirm_password: 'DifferentPassword!',
    });
    fixture.detectChanges();

    expect(component.passwordsMatch()).toBe(false);
    expect(component.canSubmitPassword()).toBe(false);

    component.savePassword();
    expect(authServiceMock.changePassword).not.toHaveBeenCalled();
  });
});
