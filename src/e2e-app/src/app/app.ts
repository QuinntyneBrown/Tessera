import { Component, signal } from '@angular/core';
import { PlayerEvent, ScormPlayer } from '@tessera/scorm-player';
import { hostFixtureFor } from './host-fixtures';

@Component({
  imports: [ScormPlayer],
  selector: 'tsr-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly fixture = hostFixtureFor(new URLSearchParams(location.search));
  protected readonly events = signal<string[]>([]);

  constructor() {
    // Host credentials a hostile course must not be able to reach.
    document.cookie = 'lms-session=secret';
    localStorage.setItem('lms-token', 'secret');
  }

  protected onEvent(event: PlayerEvent): void {
    this.events.update((events) => [...events, JSON.stringify(event)]);
  }
}
