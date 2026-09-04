import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-site-footer',
  imports: [RouterLink],
  template: `
    <footer class="site-footer">
      <div>
        <strong>CAPRICHO STORE</strong>
        <p>Catálogo académico de moda conectado a datos reales.</p>
      </div>
      <nav aria-label="Navegación de pie de página">
        <a routerLink="/catalogo">Catálogo</a><a routerLink="/login">Ingresar</a
        ><a routerLink="/registro">Crear cuenta</a>
      </nav>
      <p class="site-footer__note">Sin carrito, reservas ni pagos en esta etapa.</p>
    </footer>
  `,
})
export class SiteFooter {}
