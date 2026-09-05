import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '../../core/config/api.config';

export type Entity = Record<string, any>;
export interface ProductPage {
  items: Entity[];
  page: number;
  page_size: number;
  total: number;
  pages: number;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  list(path: string, params?: Record<string, string | number | boolean | undefined>) {
    let p = new HttpParams();
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== '') p = p.set(k, String(v));
    });
    return this.http.get<Entity[]>(`${API_BASE_URL}/${path}`, { params: p });
  }
  get(path: string) {
    return this.http.get<Entity>(`${API_BASE_URL}/${path}`);
  }
  query(path: string, params?: Record<string, string | number | boolean | undefined>) {
    let p = new HttpParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== '') p = p.set(key, String(value));
    });
    return this.http.get<Entity>(`${API_BASE_URL}/${path}`, { params: p });
  }
  post(path: string, payload: unknown) {
    return this.http.post<Entity>(`${API_BASE_URL}/${path}`, payload);
  }
  postForm(path: string, payload: FormData) {
    return this.http.post<Entity>(`${API_BASE_URL}/${path}`, payload);
  }
  patch(path: string, payload: unknown) {
    return this.http.patch<Entity>(`${API_BASE_URL}/${path}`, payload);
  }
  put(path: string, payload: unknown) {
    return this.http.put<Entity>(`${API_BASE_URL}/${path}`, payload);
  }
  delete(path: string) {
    return this.http.delete<Entity>(`${API_BASE_URL}/${path}`);
  }
  products(params?: Record<string, string | number | boolean | undefined>) {
    let p = new HttpParams();
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== '') p = p.set(k, String(v));
    });
    return this.http.get<ProductPage>(`${API_BASE_URL}/products`, { params: p });
  }
}
