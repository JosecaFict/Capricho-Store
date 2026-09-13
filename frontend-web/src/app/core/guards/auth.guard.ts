import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  if (route.queryParamMap.has('session_id')) {
    return true;
  }
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.token()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
