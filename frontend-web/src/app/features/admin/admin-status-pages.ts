import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-forbidden',
  imports: [RouterLink],
  template: `<section class="admin-state">
    <p class="eyebrow">Error 403</p>
    <h1>Acceso no autorizado</h1>
    <p>Tu usuario no tiene permisos suficientes para consultar este módulo.</p>
    <a class="button button--primary" routerLink="/admin">Volver al panel</a>
  </section>`,
})
export class AdminForbidden {}
@Component({
  selector: 'app-admin-not-found',
  imports: [RouterLink],
  template: `<section class="admin-state">
    <p class="eyebrow">Error 404</p>
    <h1>Esta ruta no existe</h1>
    <p>No encontramos la vista administrativa solicitada.</p>
    <a class="button button--primary" routerLink="/admin">Volver al panel</a>
  </section>`,
})
export class AdminNotFound {}
