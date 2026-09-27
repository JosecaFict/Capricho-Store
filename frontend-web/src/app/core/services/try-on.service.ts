import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface TryOnTaskCreateResponse {
  task_id: string;
  status: string;
  message: string;
  remaining_today?: number | null;
}

export interface TryOnTaskStatusResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  eta_seconds: number;
  step_message: string;
  result_image_url?: string | null;
  original_photo_url?: string | null;
  garment_image_url?: string | null;
  product_id: number;
  color_id?: number | null;
  color_name?: string | null;
  error?: string | null;
  is_live?: boolean;
}

export interface TryOnQuotaResponse {
  daily_limit: number;
  used_today: number;
  remaining_today: number;
}

@Injectable({ providedIn: 'root' })
export class TryOnService {
  private readonly http = inject(HttpClient);

  getQuota(): Observable<TryOnQuotaResponse> {
    return this.http.get<TryOnQuotaResponse>(`${API_BASE_URL}/try-on/quota`);
  }

  createTask(
    file: File,
    productId: number,
    colorId?: number | null,
    colorName?: string | null,
  ): Observable<TryOnTaskCreateResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('product_id', String(productId));
    if (colorId !== undefined && colorId !== null) {
      formData.append('color_id', String(colorId));
    }
    if (colorName) {
      formData.append('color_name', colorName);
    }
    return this.http.post<TryOnTaskCreateResponse>(`${API_BASE_URL}/try-on/tasks`, formData);
  }

  getTaskStatus(taskId: string): Observable<TryOnTaskStatusResponse> {
    return this.http.get<TryOnTaskStatusResponse>(`${API_BASE_URL}/try-on/tasks/${taskId}`);
  }
}
