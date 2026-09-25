import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api.config';
import { TryOnService } from './try-on.service';

describe('TryOnService', () => {
  let service: TryOnService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TryOnService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TryOnService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('creates try-on task sending form-data with file and product_id', () => {
    const file = new File(['fake-bytes'], 'selfie.jpg', { type: 'image/jpeg' });
    service.createTask(file, 42, 3, 'Azul').subscribe((res) => {
      expect(res.task_id).toBe('task-123');
      expect(res.status).toBe('processing');
    });

    const req = httpMock.expectOne(`${API_BASE_URL}/try-on/tasks`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ task_id: 'task-123', status: 'processing', message: 'Ok' });
  });

  it('gets task status by id', () => {
    service.getTaskStatus('task-123').subscribe((res) => {
      expect(res.task_id).toBe('task-123');
      expect(res.progress).toBe(100);
      expect(res.status).toBe('completed');
    });

    const req = httpMock.expectOne(`${API_BASE_URL}/try-on/tasks/task-123`);
    expect(req.request.method).toBe('GET');
    req.flush({
      task_id: 'task-123',
      status: 'completed',
      progress: 100,
      eta_seconds: 0,
      step_message: '¡Look completado!',
      product_id: 42,
    });
  });
});
