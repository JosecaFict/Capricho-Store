import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, SiteHeader, SiteFooter],
  template: `<app-site-header />
    <main id="main-content"><router-outlet /></main>
    <app-site-footer />`,
})
export class PublicLayout {}
