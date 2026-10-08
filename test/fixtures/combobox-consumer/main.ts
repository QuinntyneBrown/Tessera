import { Component, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  Combobox,
  ComboboxChipTemplate,
  ComboboxOptionTemplate,
  ComboboxEmptyTemplate,
  ComboboxSearchFn,
} from '@tessera/combobox';
import { of } from 'rxjs';
import { ScormPlayer, CourseSource } from '@tessera/scorm-player';
import { applyTheme, clearTheme, createTheme, darkTheme, lightTheme } from '@tessera/theme';
import { VideoPlayer } from '@tessera/video-player';

@Component({
  selector: 'packed-root',
  imports: [
    Combobox,
    ComboboxChipTemplate,
    ComboboxOptionTemplate,
    ComboboxEmptyTemplate,
    ReactiveFormsModule,
    ScormPlayer,
    VideoPlayer,
  ],
  template: `<main>
    <h1>Packed combobox consumer</h1>
    <button type="button" (click)="useLightTheme()">Use packed light theme</button>
    <label for="packed-learners">Packed learners</label>
    <t-combobox
      inputId="packed-learners"
      [searchFn]="search"
      [formControl]="value"
      [displayWith]="label"
    >
      <ng-template tComboboxOption let-item let-selected="selected" let-active="active">
        <span>{{ item.name }}</span>
      </ng-template>
      <ng-template tComboboxChip let-item
        ><strong>{{ item.name }}</strong></ng-template
      >
      <ng-template tComboboxEmpty let-query="query">No learners match {{ query }}</ng-template>
    </t-combobox>
    <output aria-label="Packed value">{{ names() }}</output>
    <tsr-scorm-player [source]="source" />
    <t-video-player [streamId]="null" />
  </main>`,
  styles: `
    @use '@tessera/theme/styles/tokens' as theme;
    @include theme.defaults(('colorNeutralForeground1', 'colorNeutralBackground1'));
    :host {
      display: block;
      color: theme.token('colorNeutralForeground1');
      background: theme.token('colorNeutralBackground1');
    }
  `,
})
class PackedConsumer {
  readonly source: CourseSource = {
    kind: 'manifest',
    manifestUrl: 'https://example.invalid/course/imsmanifest.xml',
  };
  constructor() {
    applyTheme(document.documentElement, createTheme({}, darkTheme));
  }
  useLightTheme(): void {
    clearTheme(document.documentElement);
    applyTheme(document.documentElement, lightTheme);
  }
  readonly value = new FormControl<{ name: string }[]>([], { nonNullable: true });
  readonly label = (item: { name: string }) => item.name;
  readonly search: ComboboxSearchFn<{ name: string }> = () =>
    of({ items: [{ name: 'Ada' }, { name: 'Grace' }], hasMore: false });
  names(): string {
    return this.value.value.map(this.label).join(', ');
  }
}
bootstrapApplication(PackedConsumer, { providers: [provideZonelessChangeDetection()] }).catch(
  console.error,
);
