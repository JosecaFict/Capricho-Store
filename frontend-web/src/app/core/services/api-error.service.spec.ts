import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { ApiErrorService } from './api-error.service';

describe('ApiErrorService', () => {
  it('does not claim that FastAPI is offline when the browser has no HTTP response', () => {
    const service = new ApiErrorService();
    const error = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });

    expect(service.message(error)).toBe(
      'No recibimos respuesta del servicio. Revisa tu conexión e intenta nuevamente.',
    );
  });
});
