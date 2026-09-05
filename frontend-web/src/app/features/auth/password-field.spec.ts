import { FormControl, FormGroup } from '@angular/forms';
import {
  matchingPasswordsValidator,
  passwordRequirements,
  strongPasswordValidator,
} from './password-field';

describe('password validation', () => {
  it('requires length, uppercase, lowercase, number and special character', () => {
    expect(passwordRequirements('Clave123!').every((requirement) => requirement.met)).toBe(true);
    expect(strongPasswordValidator(new FormControl('Clave123!'))).toBeNull();
    expect(strongPasswordValidator(new FormControl('clavesimple'))).toEqual({
      passwordStrength: true,
    });
  });

  it('requires password confirmation to match', () => {
    const form = new FormGroup({
      password: new FormControl('Clave123!'),
      passwordConfirmation: new FormControl('OtraClave123!'),
    });

    expect(matchingPasswordsValidator(form)).toEqual({ passwordMismatch: true });
    form.controls.passwordConfirmation.setValue('Clave123!');
    expect(matchingPasswordsValidator(form)).toBeNull();
  });
});
