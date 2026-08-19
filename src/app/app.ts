import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme.service';
import { Toasts } from './ui/toasts';
import { Confirm } from './ui/confirm';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toasts, Confirm],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private theme = inject(ThemeService);
  constructor() {
    this.theme.init();
  }
}
