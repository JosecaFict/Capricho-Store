import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_BASE_URL, OFFICIAL_CATEGORIES } from '../config/api.config';
import {
  Brand,
  CatalogFilters,
  CatalogOptions,
  Category,
  Color,
  Product,
  ProductImage,
  ProductMeasurement,
  ProductPage,
  Season,
  Size,
} from '../models/catalog.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  products(filters: CatalogFilters = {}): Observable<ProductPage> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '')
        params = params.set(key, String(value));
    });
    return this.http.get<ProductPage>(`${API_BASE_URL}/products`, { params });
  }

  product(id: number, branchId?: number): Observable<Product> {
    const params = branchId ? new HttpParams().set('sucursal', branchId) : undefined;
    return this.http.get<Product>(`${API_BASE_URL}/products/${id}`, { params });
  }

  images(id: number): Observable<ProductImage[]> {
    return this.http.get<ProductImage[]>(`${API_BASE_URL}/products/${id}/images`);
  }

  measurements(id: number): Observable<ProductMeasurement[]> {
    return this.http.get<ProductMeasurement[]>(`${API_BASE_URL}/products/${id}/measurements`);
  }

  options(): Observable<CatalogOptions> {
    return forkJoin({
      categories: this.http
        .get<Category[]>(`${API_BASE_URL}/categories`)
        .pipe(
          map((items) =>
            items.filter(
              (item) =>
                item.activo &&
                OFFICIAL_CATEGORIES.includes(
                  item.nombre.toUpperCase() as (typeof OFFICIAL_CATEGORIES)[number],
                ),
            ),
          ),
        ),
      brands: this.http
        .get<Brand[]>(`${API_BASE_URL}/brands`)
        .pipe(map((items) => items.filter((item) => item.activo))),
      sizes: this.http
        .get<Size[]>(`${API_BASE_URL}/sizes`)
        .pipe(map((items) => items.filter((item) => item.activo))),
      colors: this.http
        .get<Color[]>(`${API_BASE_URL}/colors`)
        .pipe(map((items) => items.filter((item) => item.activo))),
      seasons: this.http
        .get<Season[]>(`${API_BASE_URL}/seasons`)
        .pipe(map((items) => items.filter((item) => item.activo))),
    });
  }
}
