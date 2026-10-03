import {
  Component,
  ElementRef,
  InjectionToken,
  Injector,
  afterEveryRender,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import * as comboboxApi from '@tessera/combobox';
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Combobox,
  ComboboxPage,
  ComboboxOptionTemplate,
  ComboboxChipTemplate,
  ComboboxEmptyTemplate,
} from '@tessera/combobox';
import { Observable } from 'rxjs';

/** Production-component host; scenario configuration grows with each acceptance slice. */
@Component({
  selector: 'tsr-combobox-fixture',
  imports: [
    NgComponentOutlet,
    NgTemplateOutlet,
    Combobox,
    ComboboxOptionTemplate,
    ComboboxChipTemplate,
    ComboboxEmptyTemplate,
    FormsModule,
    ReactiveFormsModule,
  ],
  styles: [
    'button { min-width: 24px; min-height: 24px; } output {display: block; overflow-wrap: anywhere;} .performance-fixture > output, .performance-fixture > ul {display: none;}',
  ],
  template: `
    @if (parameters.get('dialog') === 'native') {
      <dialog
        #nativeDialog
        aria-label="Assign learners dialog"
        style="width: min(500px, calc(100vw - 4rem)); max-height: 80vh; overflow: auto"
      >
        <ng-container *ngTemplateOutlet="contents" />
      </dialog>
    } @else {
      <ng-container *ngTemplateOutlet="contents" />
    }
    <ng-template #contents>
      <main
        [class.performance-fixture]="parameters.get('performance') === 'true'"
        [attr.dir]="parameters.get('direction') || 'ltr'"
        (keydown)="recordEscape($event)"
      >
        <h1>Assign learners</h1>
        <button type="button" (click)="setDisabled(true)">Disable field</button>
        <button type="button" (click)="setDisabled(false)">Enable field</button>
        <button type="button" (click)="control.reset(null)">Reset form</button>
        <button type="button" (click)="changeConfiguration()">Change configuration</button>
        <button type="button" (click)="selected.set(['Grace'])">Write model</button>
        <button type="button" (click)="control.setValue(['Linus'])">Write control</button>
        <button type="button" (click)="replaceControl()">Replace control</button>
        <button type="button" (click)="oldControl?.disable()">Disable old control</button>
        <button type="button" (click)="mounted.set(false)">Unmount field</button>
        <button type="button" (click)="mounted.set(true)">Mount field</button>
        <button type="button" (click)="runHarness()">Run harness contract</button>
        <output aria-label="Harness contract">{{ json(harnessReport()) }}</output>
        @if (mounted()) {
          <div
            class="fixture-container"
            [style.width]="
              parameters.get('containerWidth') ? parameters.get('containerWidth') + 'px' : null
            "
            [style.height]="parameters.get('scroll') === 'true' ? '240px' : null"
            [style.overflow]="parameters.get('scroll') === 'true' ? 'auto' : null"
          >
            @if (parameters.get('scroll') === 'true') {
              <div style="height: 140px"></div>
            }
            @if (parameters.get('forms') === 'submit') {
              <form [formGroup]="group" (submit)="submit($event)">
                <label for="learners">Learners</label>
                <t-combobox inputId="learners" [searchFn]="search" formControlName="learners" />
                <button type="submit">Submit selection</button>
              </form>
            } @else {
              <form (submit)="submit($event)">
                @if (parameters.get('unlabelled') !== 'true') {
                  <label for="learners">Learners</label>
                }
                @if (parameters.get('templates') === 'true') {
                  <t-combobox inputId="learners" [searchFn]="search" [(value)]="selected">
                    <ng-template
                      tComboboxOption
                      let-item
                      let-selected="selected"
                      let-active="active"
                      ><span
                        >{{ item }} · selected={{ selected }} · active={{ active }}</span
                      ></ng-template
                    >
                    <ng-template tComboboxChip let-item
                      ><strong>Chosen {{ item }}</strong></ng-template
                    >
                    <ng-template tComboboxEmpty let-query="query"
                      ><span>No learners match {{ query }}</span></ng-template
                    >
                  </t-combobox>
                } @else if (parameters.get('forms') === 'dual') {
                  <t-combobox
                    inputId="learners"
                    [searchFn]="search"
                    [formControl]="control"
                    [(value)]="selected"
                  />
                } @else if (parameters.get('forms') === 'reactive') {
                  <t-combobox
                    inputId="learners"
                    [searchFn]="search"
                    [formControl]="control"
                    hint="Choose learners"
                    error="Selection is required."
                  />
                } @else if (parameters.get('forms') === 'template') {
                  <t-combobox
                    inputId="learners"
                    [searchFn]="search"
                    name="learners"
                    [(ngModel)]="selected"
                  />
                } @else if (parameters.get('forms') === 'model') {
                  <t-combobox inputId="learners" [searchFn]="search" [(value)]="selected" />
                } @else {
                  <ng-container
                    *ngComponentOutlet="component; inputs: inputs; injector: componentInjector"
                  />
                }
                <button type="submit">Submit selection</button>
              </form>
            }
            @if (parameters.get('scroll') === 'true') {
              <div style="height: 400px"></div>
            }
          </div>
        }
        <output aria-label="Submit count">{{ submissions() }}</output>
        @if (parameters.get('instances') === '2') {
          <t-combobox ariaLabel="Other learners" [searchFn]="search" />
        }
        <output aria-label="Ancestor escapes">{{ ancestorEscapes() }}</output>
        <output aria-label="Bound value">{{
          json(parameters.get('forms') === 'reactive' ? controlState().value : selected())
        }}</output>
        <output aria-label="Form state">{{ json(controlState()) }}</output>
        <output aria-label="Model value">{{ json(selected()) }}</output>
        <button type="button">After field</button>
        <ul aria-label="Combobox events">
          @for (event of events(); track $index) {
            <li>{{ event }}</li>
          }
        </ul>
        <ul aria-label="Search requests">
          @for (request of requests(); track $index) {
            <li>{{ request }}</li>
          }
        </ul>
      </main>
    </ng-template>
  `,
})
export class ComboboxFixture {
  readonly component = Combobox;
  readonly parameters = new URLSearchParams(location.search);
  readonly componentInjector = Injector.create({
    parent: inject(Injector),
    providers:
      this.parameters.get('localized') === 'true'
        ? [
            {
              provide:
                (comboboxApi as unknown as Record<string, unknown>)['COMBOBOX_I18N'] ||
                new InjectionToken('Pending i18n'),
              useValue: {
                noResults: 'Sin resultados',
                announceNoResults: 'Ninguna coincidencia.',
                chipListLabel: 'Elegidos',
                removeChip: 'Quitar {label}',
                clearAll: 'Borrar selección',
                showOptions: 'Mostrar opciones',
                hideOptions: 'Ocultar opciones',
                retry: 'Reintentar',
                loading: 'Cargando',
                resultsError: 'Error de búsqueda.',
              },
            },
          ]
        : [],
  });
  readonly requests = signal<string[]>([]);
  readonly events = signal<string[]>([]);
  readonly submissions = signal(0);
  readonly mounted = signal(true);
  readonly harnessReport = signal<unknown>(null);
  async runHarness(): Promise<void> {
    try {
      this.harnessReport.set(
        await (await import('./combobox-harness-contract')).runHarnessContract(),
      );
    } catch (error) {
      this.harnessReport.set({ error: String(error) });
    }
  }
  readonly ancestorEscapes = signal(0);
  recordEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.ancestorEscapes.update((count) => count + 1);
  }
  submit(event: Event): void {
    event.preventDefault();
    this.submissions.update((count) => count + 1);
  }
  private readonly outlet = viewChild(NgComponentOutlet);
  private readonly nativeDialog = viewChild<ElementRef<HTMLDialogElement>>('nativeDialog');
  private readonly directComponent = viewChild(Combobox);
  private subscribed: object | null = null;
  private attempts = 0;
  private pageAttempts = new Map<string, number>();
  private item(name: string): string | { id: number; name: string } {
    if (name === 'Ada' && this.parameters.get('hostile') === 'true')
      return '<img src=x onerror="window.__xss=1">';
    return this.parameters.get('objects') === 'true'
      ? { id: ['Ada', 'Grace', 'Linus'].indexOf(name), name }
      : name;
  }
  readonly search = (query: string, page: number) => {
    console.info(`combobox-fixture-request:${query}:${page}`);
    this.requests.update((requests) => [...requests, `${query}:${page}`]);
    const key = `${query}:${page}`;
    const attempt = (this.pageAttempts.get(key) || 0) + 1;
    this.pageAttempts.set(key, attempt);
    const fail =
      this.parameters.get('failureQuery') === query ||
      (this.parameters.get('pageFailure') === 'true' && page === 1 && attempt === 1)
        ? 'observable'
        : ++this.attempts === 1
          ? this.parameters.get('failure')
          : null;
    if (fail === 'throw') throw new Error('Fixture synchronous failure');
    return new Observable<ComboboxPage<string | { id: number; name: string }>>((subscriber) => {
      let delivered = false;
      const deliver = () => {
        delivered = true;
        if (fail === 'observable') {
          subscriber.error(new Error('Fixture failure'));
          return;
        }
        if (fail === 'empty') {
          subscriber.complete();
          return;
        }
        const size = Number(this.parameters.get('pageSize') || 0);
        const names = size
          ? Array.from({ length: size }, (_, i) => `Result ${query} ${page * size + i + 1}`)
          : page === 0
            ? this.parameters.get('longPage') === 'true'
              ? Array.from({ length: 30 }, (_, i) => `Learner ${i + 1}`)
              : ['Ada', 'Grace', 'Linus']
            : ['Morgan', 'Sam'];
        (
          window as unknown as { comboboxEmission: { query: string; page: number; time: number } }
        ).comboboxEmission = { query, page, time: performance.now() };
        subscriber.next({
          items:
            this.parameters.get('results') === 'normal' ? names.map((name) => this.item(name)) : [],
          hasMore: size
            ? page < Number(this.parameters.get('pageCount') || 1) - 1
            : this.parameters.get('paged') === 'true' && page === 0,
          ...(this.parameters.has('total') ? { total: Number(this.parameters.get('total')) } : {}),
        });
        subscriber.complete();
      };
      const delay = Number(this.parameters.get('responseDelay') || 0);
      const timeout = delay ? setTimeout(deliver, delay) : undefined;
      if (!delay) deliver();
      return () => {
        clearTimeout(timeout);
        if (!delivered) console.info(`combobox-fixture-cancelled:${query}:${page}`);
      };
    });
  };
  inputs: Record<string, unknown> = {
    inputId: 'learners',
    ...(this.parameters.get('missingSearchFn') === 'true' ? {} : { searchFn: this.search }),
    ...(this.parameters.has('debounceMs')
      ? { debounceMs: Number(this.parameters.get('debounceMs')) }
      : {}),
    ...(this.parameters.has('minSearchLength')
      ? { minSearchLength: Number(this.parameters.get('minSearchLength')) }
      : {}),
    ...(this.parameters.has('value')
      ? {
          value: this.parameters
            .get('value')!
            .split('|')
            .map((name) => this.item(name)),
        }
      : {}),
    ...(this.parameters.has('valueSize')
      ? {
          value: Array.from(
            { length: Number(this.parameters.get('valueSize')) },
            (_, i) =>
              `Learner ${i + 1} with a very long descriptive label that must fit in the field`,
          ),
        }
      : {}),
    ...(this.parameters.has('maxSelections')
      ? { maxSelections: Number(this.parameters.get('maxSelections')) }
      : {}),
    ...(this.parameters.has('disabledOption')
      ? { optionDisabled: (item: unknown) => item === this.parameters.get('disabledOption') }
      : {}),
    ...(this.parameters.has('clearSearchOnSelect')
      ? { clearSearchOnSelect: this.parameters.get('clearSearchOnSelect') === 'true' }
      : {}),
    ...(this.parameters.has('disabled')
      ? { disabled: this.parameters.get('disabled') === 'true' }
      : {}),
    ...(this.parameters.has('required')
      ? { required: this.parameters.get('required') === 'true' }
      : {}),
    ...(this.parameters.has('hint') ? { hint: this.parameters.get('hint') } : {}),
    ...(this.parameters.has('error') ? { error: this.parameters.get('error') } : {}),
    ...(this.parameters.get('objects') === 'true'
      ? {
          displayWith: (item: { name: string }) => item.name,
          compareWith: (a: { id: number }, b: { id: number }) => a.id === b.id,
        }
      : {}),
  };
  readonly selected = signal<(string | { id: number; name: string })[]>(
    (this.inputs['value'] as (string | { id: number; name: string })[]) || [],
  );
  control = new FormControl(this.selected(), {
    validators:
      this.parameters.get('required') === 'true' || this.parameters.get('validatorOnly') === 'true'
        ? Validators.required
        : [],
    updateOn: (this.parameters.get('updateOn') || 'change') as 'change' | 'blur' | 'submit',
  });
  readonly group = new FormGroup({ learners: this.control });
  oldControl: typeof this.control | undefined;
  replaceControl(): void {
    this.oldControl = this.control;
    this.control = new FormControl<(string | { id: number; name: string })[]>([], {
      validators: Validators.required,
    });
    this.control.markAsTouched();
  }
  readonly controlState = signal({
    value: this.control.value,
    dirty: false,
    touched: false,
    disabled: false,
    valid: this.control.valid,
    changes: 0,
  });
  readonly json = JSON.stringify;
  changeConfiguration(): void {
    this.inputs = {
      ...this.inputs,
      minSearchLength: 0,
      searchFn: (query: string, page: number) => this.search(query, page),
    };
  }
  setDisabled(disabled: boolean): void {
    if (this.parameters.get('forms') === 'reactive') {
      if (disabled) this.control.disable();
      else this.control.enable();
    } else this.inputs = { ...this.inputs, disabled };
  }
  constructor() {
    this.control.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() =>
        this.controlState.update((state) => ({ ...state, changes: state.changes + 1 })),
      );
    this.control.events.pipe(takeUntilDestroyed()).subscribe(() =>
      this.controlState.update((state) => ({
        ...state,
        value: this.control.value,
        dirty: this.control.dirty,
        touched: this.control.touched,
        disabled: this.control.disabled,
        valid: this.control.valid,
      })),
    );
    afterEveryRender(() => {
      const dialog = this.nativeDialog()?.nativeElement;
      if (dialog && !dialog.open) dialog.showModal();
      const instance = (this.outlet()?.componentInstance ||
        this.directComponent()) as unknown as Record<
        string,
        { subscribe: (handler: (value: unknown) => void) => void }
      > | null;
      if (!instance || instance === this.subscribed) return;
      this.subscribed = instance;
      for (const name of ['opened', 'closed', 'searchChange', 'selectionChange']) {
        instance[name]?.subscribe((value) => {
          const event = value === undefined ? name : `${name}:${JSON.stringify(value)}`;
          console.info(`combobox-fixture-event:${event}`);
          this.events.update((events) => [...events, event]);
        });
      }
    });
  }
}

/** Opens the test screen through the CDK's real dialog service. */
@Component({ selector: 'tsr-combobox-dialog-fixture', template: '' })
export class ComboboxDialogFixture {
  constructor() {
    const dialog = inject(Dialog);
    afterNextRender(() =>
      dialog.open(ComboboxFixture, {
        ariaLabel: 'Assign learners dialog',
        width: '500px',
        maxWidth: 'calc(100vw - 2rem)',
        panelClass: 'fixture-dialog',
      }),
    );
  }
}
