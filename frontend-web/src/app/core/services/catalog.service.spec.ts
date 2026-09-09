import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api.config';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the real product query parameter names', () => {
    service
      .products({
        categoria: 'POLERA',
        publico_objetivo: 'MUJER',
        permite_vestidor: true,
        sucursal: 3,
        activo: true,
        page: 2,
        page_size: 12,
        sort: '-precio',
      })
      .subscribe();
    const request = http.expectOne((candidate) => candidate.url === `${API_BASE_URL}/products`);
    expect(request.request.params.get('categoria')).toBe('POLERA');
    expect(request.request.params.get('publico_objetivo')).toBe('MUJER');
    expect(request.request.params.get('permite_vestidor')).toBe('true');
    expect(request.request.params.get('sucursal')).toBe('3');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('sort')).toBe('-precio');
    request.flush({ items: [], page: 2, page_size: 12, total: 0, pages: 0 });
  });

  it('requests product images from the documented endpoint', () => {
    service.images(7).subscribe();
    http.expectOne(`${API_BASE_URL}/products/7/images`).flush([]);
  });

  it('requests public branches for availability filters', () => {
    service.branches().subscribe();
    http.expectOne(`${API_BASE_URL}/branches`).flush([]);
  });
});
