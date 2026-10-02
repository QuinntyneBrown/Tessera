import { Component, signal } from '@angular/core';

@Component({
  imports: [],
  selector: 'tsr-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('e2e-app');
}
