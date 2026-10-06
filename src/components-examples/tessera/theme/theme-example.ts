import { Component, ElementRef, input, viewChild } from '@angular/core';
import { Combobox } from '@tessera/combobox';
import { of } from 'rxjs';
import {
  applyTheme,
  clearTheme,
  createTheme,
  darkTheme,
  lightTheme,
  tokenNames,
} from '@tessera/theme';

/** An interactive host demonstrating document and container theme inheritance. */
@Component({
  selector: 'tsr-theme-example',
  imports: [Combobox],
  template: `
    <section aria-label="Theme example">
      <h2>Shared Tessera themes</h2>
      <button type="button" (click)="setTheme('light')">Use light theme</button>
      <button type="button" (click)="setTheme('dark')">Use dark theme</button>
      <button type="button" (click)="setTheme('custom')">Use custom theme</button>
      <button type="button" (click)="setTheme('clear')">Follow system theme</button>
      <button type="button" (click)="setNested()">Set nested light theme</button>
      @if (verifyApi()) {
        <button type="button" (click)="setLegacy()">Override combobox color</button>
      }
      <div
        #scope
        class="theme-scope"
        (theme-change)="setTheme($any($event).detail)"
        (legacy-theme-change)="setLegacy()"
        style="border-top: 7px solid transparent"
      >
        <p class="theme-sample">Theme sample</p>
        <label for="theme-learners">Themed learners</label>
        <t-combobox inputId="theme-learners" [searchFn]="search" [debounceMs]="0" />
        <div #nested class="nested-scope">
          <p class="theme-sample">Nested theme sample</p>
        </div>
        <ng-content />
      </div>
      @if (verifyApi()) {
        <output aria-label="Theme API checks">{{ apiChecks }}</output>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    button {
      min-width: 24px;
      min-height: 24px;
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    .theme-sample {
      color: var(--t-colorNeutralForeground1, #18312e);
      background: var(--t-colorNeutralBackground1, #fff);
    }
  `,
})
export class ThemeExample {
  readonly verifyApi = input(false);
  protected readonly scope = viewChild.required<ElementRef<HTMLElement>>('scope');
  protected readonly nested = viewChild.required<ElementRef<HTMLElement>>('nested');
  protected readonly search = () => of({ items: ['Ada', 'Grace', 'Linus'], hasMore: false });
  protected apiChecks = '';
  protected setTheme(name: string): void {
    const element = this.scope().nativeElement;
    if (name === 'clear') clearTheme(element);
    else
      applyTheme(
        element,
        name === 'dark'
          ? darkTheme
          : name === 'custom'
            ? createTheme({ colorNeutralForeground1: '#4c1d95' })
            : lightTheme,
      );
    if (!this.verifyApi()) return;
    const overrides = Object.freeze({ colorNeutralForeground1: '#4c1d95', unsupported: 'red' });
    const custom = createTheme(overrides);
    if (
      Object.isFrozen(custom) &&
      Object.isFrozen(lightTheme) &&
      Object.isFrozen(darkTheme) &&
      overrides.colorNeutralForeground1 === '#4c1d95' &&
      lightTheme.colorNeutralForeground1 === '#18312e' &&
      !('unsupported' in custom) &&
      Object.keys(custom).length === tokenNames.length &&
      element.style.borderTopWidth === '7px'
    )
      this.apiChecks = 'immutable inputs; supported tokens; unrelated styles preserved';
  }
  protected setNested(): void {
    applyTheme(this.nested().nativeElement, lightTheme);
  }
  protected setLegacy(): void {
    this.scope().nativeElement.style.setProperty('--t-combobox-text', '#4c1d95');
  }
}
