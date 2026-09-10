import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../core/config/api.config';
import { AdminApiService } from './admin-api.service';

describe('AdminApiService', () => {
  let service: AdminApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('omits empty optional filters instead of sending null as text', () => {
    service.list('inventory', { sucursal: null, stock_bajo: false }).subscribe();
    const request = http.expectOne((candidate) => candidate.url === `${API_BASE_URL}/inventory`);
    expect(request.request.params.has('sucursal')).toBe(false);
    expect(request.request.params.get('stock_bajo')).toBe('false');
    request.flush([]);
  });

  it('sends multipart image replacements with PUT', () => {
    const payload = new FormData();
    payload.append('file', new Blob(['image'], { type: 'image/webp' }), 'producto.webp');
    service.putForm('product-images/4/replace', payload).subscribe();
    const request = http.expectOne(`${API_BASE_URL}/product-images/4/replace`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toBe(payload);
    request.flush({});
  });
});
