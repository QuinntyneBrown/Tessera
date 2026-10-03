import { Component, signal } from '@angular/core';
import { CourseSource, PlayerEvent, ScormPlayer } from '@tessera/scorm-player';
import { hostFixtureFor, SaveGate } from './host-fixtures';
import { ComboboxFixture, ComboboxDialogFixture } from './combobox-fixture';
import { ComboboxExamples } from '../../../components-examples/tessera/combobox';

@Component({
  imports: [ScormPlayer, ComboboxFixture, ComboboxDialogFixture, ComboboxExamples],
  selector: 'tsr-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly examplesMode =
    new URLSearchParams(location.search).get('screen') === 'combobox-examples';
  protected readonly cdkDialog = new URLSearchParams(location.search).get('dialog') === 'cdk';
  protected readonly comboboxMode =
    new URLSearchParams(location.search).get('screen') === 'combobox';
  protected readonly events = signal<string[]>([]);
  protected readonly saves = signal<string[]>([]);
  protected readonly gate = new SaveGate();
  protected readonly fixture = hostFixtureFor(
    new URLSearchParams(location.search),
    (context, submission) =>
      this.saves.update((saves) => [...saves, JSON.stringify({ context, ...submission })]),
    this.gate,
  );

  protected readonly zipMode = new URLSearchParams(location.search).get('source') === 'zip';
  protected readonly chosenPackage = signal<CourseSource | undefined>(undefined);

  protected choosePackage(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.chosenPackage.set({ kind: 'zip', file });
  }

  constructor() {
    // Host credentials a hostile course must not be able to reach.
    document.cookie = 'lms-session=secret';
    localStorage.setItem('lms-token', 'secret');
  }

  protected onEvent(event: PlayerEvent): void {
    this.events.update((events) => [...events, JSON.stringify(event)]);
  }
}
