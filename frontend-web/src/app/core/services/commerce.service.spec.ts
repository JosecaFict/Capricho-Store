import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api.config';
import { CommerceService } from './commerce.service';

describe('CommerceService', () => {
  let service: CommerceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CommerceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('adds a selected variant to the customer cart', () => {
    service.addCartItem(42, 2).subscribe();

    const request = http.expectOne(`${API_BASE_URL}/cart/items`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ id_variante: 42, cantidad: 2 });
    request.flush({ id_carrito: 1, estado: 'ACTIVO', items: [], total: 0 });
  });

  it('requests a backend shipping quote with branch and address', () => {
    service.quoteShipping(3, 9).subscribe();

    const request = http.expectOne(`${API_BASE_URL}/shipping-quotes`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ id_sucursal: 3, id_direccion: 9 });
    request.flush({});
  });

  it('updates an existing delivery address through FastAPI', () => {
    service.updateAddress(9, { direccion: 'Av. Principal 50' }).subscribe();

    const request = http.expectOne(`${API_BASE_URL}/addresses/9`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ direccion: 'Av. Principal 50' });
    request.flush({});
  });

  it('uses supplier history filters and pagination', () => {
    service.supplierPurchaseHistory({ proveedor: 8, page: 2, page_size: 25 }).subscribe();

    const request = http.expectOne(
      (candidate) => candidate.url === `${API_BASE_URL}/supplier-purchase-history`,
    );
    expect(request.request.params.get('proveedor')).toBe('8');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('page_size')).toBe('25');
    request.flush({ items: [], total: 0, page: 2, page_size: 25 });
  });
});
