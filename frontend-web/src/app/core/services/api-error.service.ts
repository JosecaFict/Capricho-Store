import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiErrorService {
  message(
    error: unknown,
    fallback = 'No pudimos completar la operación. Intenta nuevamente.',
  ): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 0)
      return 'No pudimos conectar con el servicio. Verifica que FastAPI esté activo.';
    if (error.status === 401) return 'Tu sesión no es válida o ha expirado.';
    if (error.status === 403) return 'No tienes permiso para realizar esta acción.';
    if (error.status === 404) return 'No encontramos la información solicitada.';
    if (error.status === 409) return this.detail(error) ?? 'Ya existe un registro con esos datos.';
    if (error.status === 422)
      return this.validationMessage(error) ?? 'Revisa los datos ingresados.';
    return this.detail(error) ?? fallback;
  }

  private detail(error: HttpErrorResponse): string | null {
    return typeof error.error?.detail === 'string' ? error.error.detail : null;
  }

  private validationMessage(error: HttpErrorResponse): string | null {
    const detail = error.error?.detail;
    if (!Array.isArray(detail)) return this.detail(error);
    return detail
      .map((item: { msg?: string }) => item.msg)
      .filter(Boolean)
      .join(' ');
  }
}
