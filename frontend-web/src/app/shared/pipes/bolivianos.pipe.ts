import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'bolivianos' })
export class BolivianosPipe implements PipeTransform {
  transform(value: string | number | null): string {
    if (value === null || value === '') return 'Precio no disponible';
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount)
      : 'Precio no disponible';
  }
}
