import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-status-panel',
  template: `
    <section
      class="status-panel"
      [class.status-panel--error]="kind() === 'error'"
      aria-live="polite"
    >
      <h2>{{ title() }}</h2>
      <p>{{ message() }}</p>
      @if (kind() === 'error') {
        <button class="button button--secondary" type="button" (click)="retry.emit()">
          Intentar nuevamente
        </button>
      }
    </section>
  `,
})
export class StatusPanel {
  readonly kind = input<'empty' | 'error'>('empty');
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly retry = output<void>();
}
