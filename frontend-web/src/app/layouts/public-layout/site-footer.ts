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
        <a routerLink="/catalogo">Catálogo</a><a routerLink="/carrito">Carrito</a
        ><a routerLink="/pedidos">Pedidos</a>
      </nav>
      <p class="site-footer__note">Compra online sin cobro digital y retiro o delivery estimado.</p>
    </footer>
  `,
})
export class SiteFooter {}
