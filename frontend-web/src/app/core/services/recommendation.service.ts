import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  InteractionType,
  RecommendationConfig,
  RecommendationConfigUpdate,
  RecommendationStats,
  RecommendedProduct,
} from '../models/recommendation.model';

@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private readonly http = inject(HttpClient);

  getConfig(): Observable<RecommendationConfig> {
    return this.http.get<RecommendationConfig>(`${API_BASE_URL}/admin/recommendations/config`);
  }

  updateConfig(payload: RecommendationConfigUpdate): Observable<RecommendationConfig> {
    return this.http.put<RecommendationConfig>(
      `${API_BASE_URL}/admin/recommendations/config`,
      payload
    );
  }

  getStats(): Observable<RecommendationStats> {
    return this.http.get<RecommendationStats>(`${API_BASE_URL}/admin/recommendations/stats`);
  }

  simulateForClient(clientId: number, limit = 6): Observable<RecommendedProduct[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<RecommendedProduct[]>(
      `${API_BASE_URL}/admin/recommendations/simulate/${clientId}`,
      { params }
    );
  }

  getPersonalizedRecommendations(limit = 8): Observable<RecommendedProduct[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<RecommendedProduct[]>(`${API_BASE_URL}/recommendations`, { params });
  }

  getRelatedProducts(productId: number, limit = 4): Observable<RecommendedProduct[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<RecommendedProduct[]>(
      `${API_BASE_URL}/recommendations/products/${productId}/related`,
      { params }
    );
  }

  trackInteraction(payload: {
    id_producto: number;
    id_variante?: number | null;
    tipo_interaccion: InteractionType;
  }): Observable<any> {
    return this.http.post(`${API_BASE_URL}/recommendations/interaction`, payload);
  }
}
