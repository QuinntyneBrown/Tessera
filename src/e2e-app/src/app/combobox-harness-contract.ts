import '@angular/compiler';
import { Component, getPlatform, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import {
  ComponentHarness,
  ComponentHarnessConstructor,
  manualChangeDetection,
} from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import * as api from '@tessera/combobox';
import { of } from 'rxjs';

interface ContractHarness extends ComponentHarness {
  open(): Promise<void>;
  isOpen(): Promise<boolean>;
  search(text: string): Promise<void>;
  getOptions(): Promise<{ label: string; selected: boolean; disabled: boolean }[]>;
  toggleOption(labelOrIndex: string | number): Promise<void>;
  getChips(): Promise<string[]>;
  removeChip(labelOrIndex: string | number): Promise<void>;
}

@Component({
  imports: [api.Combobox],
  template: `
    <t-combobox
      ariaLabel="Harness learners"
      [searchFn]="search"
      [(value)]="value"
      [optionDisabled]="disabled"
    />
    <t-combobox ariaLabel="Other learners" [searchFn]="search" />
  `,
})
class HarnessHost {
  readonly value = signal(['Ada']);
  readonly search = () => of({ items: ['Ada', 'Grace', 'Linus'], hasMore: false });
  readonly disabled = (item: string) => item === 'Linus';
}

let initialized = false;
/** Browser-only contract bridge; timing is explicit rather than hidden in stabilization. */
export async function runHarnessContract(): Promise<unknown> {
  const constructor = (api as unknown as Record<string, unknown>)[
    'ComboboxHarness'
  ] as ComponentHarnessConstructor<ContractHarness>;
  if (!constructor) return { error: 'ComboboxHarness unavailable' };
  if (!initialized) {
    TestBed.initTestEnvironment(BrowserTestingModule, getPlatform() || platformBrowserTesting());
    initialized = true;
  }
  await TestBed.configureTestingModule({
    imports: [HarnessHost],
    providers: [provideZonelessChangeDetection()],
  }).compileComponents();
  const fixture = TestBed.createComponent(HarnessHost);
  fixture.detectChanges();
  try {
    return await manualChangeDetection(async () => {
      const [first, second] =
        await TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(constructor);
      const closed = await first.isOpen();
      await first.open();
      fixture.detectChanges();
      const opened = await first.isOpen();
      await first.search('ad');
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve, 350));
      fixture.detectChanges();
      const options = await first.getOptions();
      await first.toggleOption('Grace');
      fixture.detectChanges();
      const chips = await first.getChips();
      await first.removeChip(0);
      fixture.detectChanges();
      const remaining = await first.getChips();
      await first.toggleOption(2);
      fixture.detectChanges();
      const afterDisabled = await first.getChips();
      let missing = false;
      try {
        await first.toggleOption('Missing');
      } catch (error) {
        missing = String(error).includes('Missing');
      }
      return {
        closed,
        opened,
        options,
        chips,
        remaining,
        afterDisabled,
        missing,
        otherOpen: await second.isOpen(),
      };
    });
  } finally {
    fixture.destroy();
    TestBed.resetTestingModule();
  }
}
