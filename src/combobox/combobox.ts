import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  TemplateRef,
  ViewContainerRef,
  afterEveryRender,
  afterNextRender,
  computed,
  contentChild,
  effect,
  forwardRef,
  inject,
  input,
  isDevMode,
  model,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  ComboboxChipTemplate,
  ComboboxEmptyTemplate,
  ComboboxOptionTemplate,
} from './combobox-templates';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  NgControl,
  Validators,
} from '@angular/forms';
import { ActiveDescendantKeyManager } from '@angular/cdk/a11y';
import {
  ConnectedPosition,
  FlexibleConnectedPositionStrategy,
  Overlay,
  OverlayContainer,
  OverlayPositionBuilder,
  OverlayRef,
} from '@angular/cdk/overlay';
import { ComboboxOverlayContainer } from './combobox-overlay-container';
import { TemplatePortal } from '@angular/cdk/portal';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Subject,
  Subscription,
  catchError,
  debounce,
  defer,
  finalize,
  switchMap,
  take,
  takeUntil,
  tap,
  throwIfEmpty,
  timer,
} from 'rxjs';
import { ComboboxSearchFn, ComboboxSelectionChange } from './types';
import {
  COMBOBOX_I18N,
  ComboboxStrings,
  DEFAULT_COMBOBOX_STRINGS,
  formatComboboxString,
} from './i18n';
import { ComboboxAnnouncer } from './combobox-announcer';
import { ComboboxOption } from './combobox-option';

let nextInstance = 0;

/** Browser-only multi-selection control. Implemented in acceptance-tested slices. */
@Component({
  selector: 't-combobox',
  imports: [ComboboxOption, NgTemplateOutlet],
  providers: [
    Overlay,
    OverlayPositionBuilder,
    { provide: OverlayContainer, useClass: ComboboxOverlayContainer },
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Combobox), multi: true },
  ],
  templateUrl: './combobox.html',
  styleUrl: './combobox.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown)': 'onHostKeydown($event)', '(focusout)': 'onFocusout($event)' },
})
export class Combobox<T> implements ControlValueAccessor, OnInit {
  private readonly uid = ++nextInstance;
  protected readonly strings = { ...DEFAULT_COMBOBOX_STRINGS, ...inject(COMBOBOX_I18N) };
  readonly searchFn = input.required<ComboboxSearchFn<T>>();
  readonly inputId = input(`t-combobox-${this.uid}-input`);
  readonly ariaLabel = input<string | null>(null);
  readonly debounceMs = input(300);
  readonly minSearchLength = input(1);
  readonly opened = output<void>();
  readonly closed = output<void>();
  readonly searchChange = output<string>();
  readonly value = model<T[]>([]);
  readonly displayWith = input<(item: T) => string>(String);
  readonly compareWith = input<(a: T, b: T) => boolean>(Object.is);
  readonly optionDisabled = input<(item: T) => boolean>(() => false);
  readonly maxSelections = input<number | null>(null);
  readonly clearSearchOnSelect = input(false);
  readonly disabled = input(false);
  readonly required = input(false);
  readonly placeholder = input('');
  readonly hint = input('');
  readonly error = input('');
  protected readonly formDisabled = signal(false);
  protected readonly localTouched = signal(false);
  private readonly controlVersion = signal(0);
  protected readonly isRequired = computed(() => {
    this.controlVersion();
    return this.required() || !!this.ngControl?.control?.hasValidator(Validators.required);
  });
  protected readonly showError = computed(() => {
    this.controlVersion();
    const control = this.ngControl?.control;
    return control
      ? control.touched && control.invalid
      : this.localTouched() && this.required() && !this.value().length;
  });
  protected readonly errorText = computed(
    () =>
      this.error() || (this.isRequired() && !this.value().length ? this.strings.requiredError : ''),
  );
  protected readonly summary = computed(() =>
    this.format('selectedSummary', {
      n: this.value().length,
      labels: this.value().map(this.displayWith()).join(this.strings.labelSeparator),
    }),
  );
  protected readonly errorId = `t-combobox-${this.uid}-error`;
  protected readonly hintId = `t-combobox-${this.uid}-hint`;
  protected readonly summaryId = `t-combobox-${this.uid}-summary`;
  protected readonly describedBy = computed(
    () =>
      [
        this.showError() && this.errorText() ? this.errorId : null,
        this.hint() ? this.hintId : null,
        this.value().length ? this.summaryId : null,
      ]
        .filter(Boolean)
        .join(' ') || null,
  );
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());
  protected readonly canSelectMore = computed(
    () => this.maxSelections() === null || this.value().length < this.maxSelections()!,
  );
  readonly selectionChange = output<ComboboxSelectionChange<T>>();
  protected readonly isOpen = signal(false);
  protected readonly query = signal('');
  protected readonly results = signal<T[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly total = signal<number | null>(null);
  private pageIndex = -1;
  protected readonly activeIndex = signal(-1);
  protected readonly activeOptionId = computed(() =>
    this.isOpen() ? this.options()[this.activeIndex()]?.id || null : null,
  );
  protected readonly status = signal<'idle' | 'loading' | 'error'>('idle');
  protected readonly announcer = new ComboboxAnnouncer(inject(DestroyRef));
  protected readonly listId = `t-combobox-${this.uid}-list`;
  protected readonly optionTemplate = contentChild(ComboboxOptionTemplate<T>);
  protected readonly chipTemplate = contentChild(ComboboxChipTemplate<T>);
  protected readonly emptyTemplate = contentChild(ComboboxEmptyTemplate);
  private readonly field = viewChild.required<ElementRef<HTMLElement>>('field');
  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');
  private readonly textInput = viewChild.required<ElementRef<HTMLInputElement>>('textInput');
  private readonly removeButtons = viewChildren<ElementRef<HTMLButtonElement>>('removeButton');
  private readonly options = viewChildren(ComboboxOption);
  private optionSnapshot: readonly ComboboxOption[] = [];
  private keyManager: ActiveDescendantKeyManager<ComboboxOption> | undefined;
  private openingMode: 'normal' | 'last' | 'none' = 'normal';
  private needsActivation = false;
  private readonly overlay = inject(Overlay);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private ngControl: NgControl | null = null;
  private boundControl: AbstractControl | null = null;
  private controlSubscription: Subscription | undefined;
  private popup: OverlayRef | undefined;
  private popupPosition: FlexibleConnectedPositionStrategy | undefined;
  private widthObserver: ResizeObserver | undefined;
  private popupListeners: (() => void) | undefined;
  private geometryFrame: number | undefined;
  private popupGeometryKey: readonly number[] | undefined;
  private tooltip: OverlayRef | undefined;
  protected readonly tooltipText = signal('');
  protected readonly tooltipId = `t-combobox-${this.uid}-tooltip`;
  private readonly tooltipTemplate = viewChild.required<TemplateRef<unknown>>('tooltipTemplate');
  private hoveredChip: HTMLElement | null = null;
  private tooltipChip: HTMLElement | null = null;
  private tooltipHovered = false;
  private tooltipTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly queries = new Subject<string | null>();
  private readonly invalidated = new Subject<void>();
  private readonly requests = new Subject<{ query: string; page: number }>();
  private lastRequest = { query: '', page: 0 };
  private completedQuery: string | undefined;
  private committedQuery: string | undefined;
  private composing = false;
  private navigationIntent = false;
  private queryPending = false;
  private onChange: (value: T[]) => void = () => {};
  private onTouched: () => void = () => {};
  private synchronizedValue: T[] | undefined;

  writeValue(value: T[] | null): void {
    const next = value ?? [];
    this.synchronizedValue = next;
    this.value.set(next);
  }
  registerOnChange(fn: (value: T[]) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
  }
  ngOnInit(): void {
    this.searchFn();
    this.ngControl = this.injector.get(NgControl, null, { self: true, optional: true });
  }

  private bindControl(): void {
    const control = this.ngControl?.control || null;
    if (control === this.boundControl) return;
    this.controlSubscription?.unsubscribe();
    this.boundControl = control;
    this.formDisabled.set(!!control?.disabled);
    this.controlVersion.update((version) => version + 1);
    this.controlSubscription = control?.events.subscribe(() => {
      this.formDisabled.set(control.disabled);
      this.controlVersion.update((version) => version + 1);
    });
  }

  constructor() {
    afterNextRender(() => {
      if (isDevMode() && !this.listLabel().trim())
        throw new Error(
          'Combobox: an accessible name is required. Supply a visible label through inputId or ariaLabel.',
        );
    });
    effect(() => {
      const value = this.value();
      this.controlVersion();
      untracked(() => {
        if (this.boundControl && value !== this.synchronizedValue) {
          this.synchronizedValue = value;
          this.boundControl.setValue(value);
        }
      });
    });
    let configured = false;
    effect(() => {
      const delay = this.debounceMs(),
        minimum = this.minSearchLength(),
        maximum = this.maxSelections();
      if (!Number.isFinite(delay) || delay < 0)
        throw new Error('Combobox: invalid debounceMs; expected a finite non-negative number.');
      if (!Number.isInteger(minimum) || minimum < 0)
        throw new Error('Combobox: invalid minSearchLength; expected a non-negative integer.');
      if (maximum !== null && (!Number.isInteger(maximum) || maximum < 0))
        throw new Error(
          'Combobox: invalid maxSelections; expected null or a non-negative integer.',
        );
      this.searchFn();
      if (configured)
        untracked(() => {
          this.invalidated.next();
          this.queries.next(null);
          this.queryPending = false;
          this.announcer.cancelSearch();
          this.completedQuery = undefined;
          this.results.set([]);
          this.hasMore.set(false);
          this.total.set(null);
          this.pageIndex = -1;
          this.status.set('idle');
          if (
            !this.isDisabled() &&
            !this.composing &&
            this.isOpen() &&
            this.query().length >= minimum
          )
            this.requests.next({ query: this.query(), page: 0 });
        });
      configured = true;
    });
    effect(() => {
      if (this.isDisabled()) {
        this.close();
        this.invalidated.next();
        this.queries.next(null);
        this.announcer.cancelSearch();
        this.queryPending = false;
      }
    });
    afterEveryRender(() => {
      this.bindControl();
      // Host content can move the field without changing its size or component signals.
      // Coalesce measurements; unchanged geometry skips CDK positioning writes.
      this.schedulePopupGeometry();
      const options = this.options();
      if (options !== this.optionSnapshot) {
        const previous = this.activeIndex();
        this.keyManager?.destroy();
        this.keyManager = new ActiveDescendantKeyManager(options)
          .withWrap(false)
          .skipPredicate(() => false);
        this.keyManager.change.subscribe((index) => this.activeIndex.set(index));
        this.optionSnapshot = options;
        if (!this.needsActivation) this.keyManager.setActiveItem(previous);
      }
      if (this.needsActivation && this.isOpen()) {
        this.needsActivation = false;
        this.keyManager?.setActiveItem(
          this.openingMode === 'none'
            ? -1
            : this.openingMode === 'last'
              ? options.length - 1
              : options.findIndex((option) => !option.disabled),
        );
      }
    });
    this.queries
      .pipe(
        debounce(() => timer(this.debounceMs())),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((query) => {
        this.queryPending = false;
        if (query !== null && query !== this.committedQuery) {
          this.committedQuery = query;
          this.searchChange.emit(query);
        }
        if (query !== null && query.length < this.minSearchLength()) {
          this.results.set([]);
          this.hasMore.set(false);
          this.total.set(null);
          this.pageIndex = -1;
          this.completedQuery = undefined;
        }
        if (
          !this.isDisabled() &&
          query !== null &&
          query.length >= this.minSearchLength() &&
          query !== this.completedQuery
        )
          this.requests.next({ query, page: 0 });
      });
    this.requests
      .pipe(
        switchMap((request) => {
          this.lastRequest = request;
          this.status.set('loading');
          const loadingTimer = setTimeout(() => {
            if (this.isOpen()) this.announcer.search(this.strings.announceLoading);
          }, 1000);
          return defer(() => this.searchFn()(request.query, request.page)).pipe(
            take(1),
            throwIfEmpty(),
            takeUntil(this.invalidated),
            tap((page) => {
              this.completedQuery = request.query;
              this.pageIndex = request.page;
              this.hasMore.set(page.hasMore);
              this.total.set(page.total ?? null);
              this.results.set(
                request.page === 0 ? page.items : [...this.results(), ...page.items],
              );
              this.needsActivation = request.page === 0;
              if (this.isOpen()) {
                if (request.page === 0)
                  this.announcer.search(
                    page.items.length
                      ? this.format(
                          page.items.length === 1 ? 'announceResult' : 'announceResults',
                          { n: page.items.length },
                        )
                      : this.strings.announceNoResults,
                  );
                else if (page.items.length)
                  this.announcer.search(
                    this.format(
                      page.items.length === 1 ? 'announceMoreLoadedOne' : 'announceMoreLoaded',
                      { n: page.items.length },
                    ),
                  );
              }
            }),
            catchError(() => {
              this.status.set('error');
              if (this.isOpen()) this.announcer.failure(this.strings.resultsError);
              return EMPTY;
            }),
            finalize(() => {
              clearTimeout(loadingTimer);
              if (this.status() === 'loading') this.status.set('idle');
            }),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe();
    inject(DestroyRef).onDestroy(() => {
      this.hideTooltip();
      this.tooltip?.dispose();
      this.stopPopupTracking();
      this.popup?.dispose();
      this.keyManager?.destroy();
      this.controlSubscription?.unsubscribe();
    });
  }

  protected format(key: keyof ComboboxStrings, values: Record<string, unknown> = {}): string {
    return formatComboboxString(this.strings[key], values);
  }

  protected retry(): void {
    if (
      !this.isDisabled() &&
      !this.composing &&
      !this.queryPending &&
      this.status() === 'error' &&
      this.lastRequest.query === this.query()
    )
      this.requests.next(this.lastRequest);
  }

  protected loadMore(): void {
    if (
      this.isDisabled() ||
      this.composing ||
      this.queryPending ||
      this.status() !== 'idle' ||
      !this.hasMore() ||
      this.completedQuery !== this.query()
    )
      return;
    this.requests.next({ query: this.query(), page: this.pageIndex + 1 });
    this.textInput().nativeElement.focus();
  }

  protected onListScroll(event: Event): void {
    const list = event.target as HTMLElement;
    if (
      list.scrollHeight > list.clientHeight &&
      list.scrollHeight - list.scrollTop - list.clientHeight <= 8
    )
      this.loadMore();
  }

  protected isSelected(item: T): boolean {
    return this.value().some((selected) => this.compareWith()(selected, item));
  }

  protected toggle(item: T): void {
    if (this.isDisabled() || this.isOptionDisabled(item)) return;
    const index = this.value().findIndex((selected) => this.compareWith()(selected, item));
    const next =
      index < 0
        ? [...this.value(), item]
        : this.value().filter((_, position) => position !== index);
    this.commit(next, index < 0 ? { added: item } : { removed: this.value()[index] });
    this.textInput().nativeElement.focus();
    if (index < 0 && this.clearSearchOnSelect()) this.changeQuery('');
  }

  protected isOptionDisabled(item: T): boolean {
    return this.optionDisabled()(item) || (!this.canSelectMore() && !this.isSelected(item));
  }

  private commit(next: T[], change: { added?: T; removed?: T }): void {
    this.synchronizedValue = next;
    this.value.set(next);
    this.onChange(next);
    this.selectionChange.emit({ ...change, value: next });
    if (Object.hasOwn(change, 'added'))
      this.announcer.selection(
        this.format(next.length === 1 ? 'announceSelectedOne' : 'announceSelected', {
          label: this.displayWith()(change.added as T),
          n: next.length,
        }),
      );
    else if (Object.hasOwn(change, 'removed'))
      this.announcer.selection(
        this.format('announceRemoved', { label: this.displayWith()(change.removed as T) }),
      );
    else this.announcer.selection(this.strings.announceCleared);
    if (Object.hasOwn(change, 'added') && !this.canSelectMore())
      this.announcer.selection(this.format('announceMaxReached', { max: this.maxSelections() }));
  }

  protected removeChip(index: number): void {
    if (this.isDisabled()) return;
    this.hideTooltip();
    const buttons = this.removeButtons();
    (buttons[index + 1] || buttons[index - 1] || this.textInput()).nativeElement.focus();
    this.commit(
      this.value().filter((_, position) => position !== index),
      { removed: this.value()[index] },
    );
  }

  protected clearAll(): void {
    if (this.isDisabled()) return;
    this.hideTooltip();
    this.textInput().nativeElement.focus();
    this.commit([], {});
  }

  protected onInput(event: Event): void {
    this.changeQuery((event.target as HTMLInputElement).value);
  }

  private changeQuery(text: string, open = true): void {
    if (this.isDisabled()) return;
    this.queryPending = true;
    this.navigationIntent = false;
    this.openingMode = 'normal';
    this.announcer.cancelSearch();
    this.query.set(text);
    if (open) this.open();
    this.invalidated.next();
    if (!this.composing) this.queries.next(text);
  }

  protected open(mode: 'normal' | 'last' | 'none' = 'normal'): void {
    if (this.isDisabled() || this.isOpen()) return;
    this.openingMode = mode;
    this.needsActivation = true;
    const origin = this.field().nativeElement;
    if (!this.popup) {
      this.popupPosition = this.overlay
        .position()
        .flexibleConnectedTo(origin)
        .withPopoverLocation('inline')
        .withPush(false)
        .withFlexibleDimensions(true)
        .withGrowAfterOpen(true)
        .withPositions([
          { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
          { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
        ]);
      this.popup = this.overlay.create({
        positionStrategy: this.popupPosition,
        width: origin.getBoundingClientRect().width,
        scrollStrategy: this.overlay.scrollStrategies.reposition(),
      });
      this.popup
        .outsidePointerEvents()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((event) => {
          if (!this.host.nativeElement.contains(event.target as Node)) this.close();
        });
      this.popup.overlayElement.addEventListener('keydown', (event) => {
        if (!this.host.nativeElement.contains(this.popup!.overlayElement))
          this.onHostKeydown(event);
      });
      this.popup.overlayElement.addEventListener('focusout', (event) => {
        if (!this.host.nativeElement.contains(this.popup!.overlayElement)) this.onFocusout(event);
      });
    }
    this.isOpen.set(true);
    this.popupGeometryKey = undefined;
    this.popup.attach(new TemplatePortal(this.panel(), this.viewContainer));
    this.inheritPopupTheme(this.popup);
    this.widthObserver = new ResizeObserver(() => this.schedulePopupGeometry());
    this.widthObserver.observe(origin);
    const reposition = (event: Event) => {
      if (!(event.target instanceof Node) || !this.popup?.overlayElement.contains(event.target))
        this.schedulePopupGeometry();
    };
    document.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    visualViewport?.addEventListener('resize', reposition);
    this.popupListeners = () => {
      document.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      visualViewport?.removeEventListener('resize', reposition);
    };
    this.updatePopupGeometry();
    this.opened.emit();
    if (!this.canSelectMore())
      this.announcer.selection(this.format('announceMaxReached', { max: this.maxSelections() }));
    if (
      !this.composing &&
      !this.queryPending &&
      this.status() !== 'loading' &&
      this.query().length >= this.minSearchLength() &&
      this.completedQuery !== this.query()
    )
      this.requests.next({ query: this.query(), page: 0 });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.isDisabled() || event.isComposing || this.composing) return;
    if (['Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(event.key))
      this.navigationIntent = false;
    if (
      event.key === this.previousChipKey() &&
      this.textInput().nativeElement.selectionStart === 0 &&
      this.value().length
    ) {
      event.preventDefault();
      this.removeButtons().at(-1)!.nativeElement.focus();
      return;
    }
    if (event.key === 'Backspace' && !this.query() && this.value().length) {
      event.preventDefault();
      this.commit(this.value().slice(0, -1), { removed: this.value().at(-1)! });
      return;
    }
    if (event.key === ' ' && this.isOpen() && this.navigationIntent && this.activeIndex() >= 0) {
      event.preventDefault();
      this.toggle(this.results()[this.activeIndex()]);
      return;
    }
    if (this.isOpen() && (event.key === 'PageDown' || event.key === 'PageUp')) {
      event.preventDefault();
      this.navigationIntent = true;
      this.openingMode = 'normal';
      if (
        event.key === 'PageDown' &&
        this.activeIndex() === this.results().length - 1 &&
        this.hasMore()
      ) {
        this.loadMore();
        return;
      }
      const list = this.popup?.overlayElement.querySelector('[role="listbox"]');
      const bounds = list?.getBoundingClientRect();
      const visible = bounds
        ? Array.from(list!.children).filter((element) => {
            const row = element.getBoundingClientRect();
            return row.top >= bounds.top && row.bottom <= bounds.bottom;
          }).length
        : 1;
      const last = this.results().length - 1;
      const index =
        this.activeIndex() < 0
          ? event.key === 'PageDown'
            ? 0
            : last
          : this.activeIndex() + Math.max(1, visible) * (event.key === 'PageDown' ? 1 : -1);
      this.keyManager?.setActiveItem(Math.max(0, Math.min(last, index)));
      return;
    }
    if (event.key === 'Enter' && this.isOpen()) {
      event.preventDefault();
      if (this.status() === 'error') this.retry();
      else if (this.activeIndex() >= 0) this.toggle(this.results()[this.activeIndex()]);
      else this.loadMore();
      return;
    }
    if (event.key === 'ArrowDown' || (event.key === 'ArrowUp' && !event.altKey)) {
      event.preventDefault();
      this.navigationIntent = !event.altKey;
      if (!this.isOpen())
        this.open(event.altKey ? 'none' : event.key === 'ArrowUp' ? 'last' : 'normal');
      else if (!event.altKey) {
        this.openingMode = 'normal';
        if (
          event.key === 'ArrowDown' &&
          this.activeIndex() === this.results().length - 1 &&
          this.hasMore()
        )
          this.loadMore();
        else this.keyManager?.onKeydown(event);
      }
    }
  }

  protected togglePopup(): void {
    if (this.isDisabled()) return;
    this.textInput().nativeElement.focus();
    if (this.isOpen()) this.close();
    else this.open();
  }

  protected onCursorMove(): void {
    this.navigationIntent = false;
  }

  protected focusAndOpen(): void {
    if (this.isDisabled()) return;
    this.textInput().nativeElement.focus();
    this.open();
  }

  protected close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.navigationIntent = false;
    this.activeIndex.set(-1);
    this.keyManager?.setActiveItem(-1);
    this.announcer.cancelSearch();
    this.stopPopupTracking();
    this.popupGeometryKey = undefined;
    this.popup?.detach();
    this.closed.emit();
  }

  private stopPopupTracking(): void {
    if (this.geometryFrame !== undefined) {
      cancelAnimationFrame(this.geometryFrame);
      this.geometryFrame = undefined;
    }
    this.widthObserver?.disconnect();
    this.widthObserver = undefined;
    this.popupListeners?.();
    this.popupListeners = undefined;
  }

  private schedulePopupGeometry(): void {
    if (!this.isOpen() || this.geometryFrame !== undefined) return;
    this.geometryFrame = requestAnimationFrame(() => {
      this.geometryFrame = undefined;
      this.updatePopupGeometry();
    });
  }

  private updatePopupGeometry(): void {
    if (!this.isOpen() || !this.popup) return;
    const input = this.textInput().nativeElement;
    const viewportTop = visualViewport?.offsetTop || 0;
    const viewportBottom = viewportTop + (visualViewport?.height || innerHeight);
    const inputBounds = input.getBoundingClientRect();
    if (inputBounds.top < viewportTop || inputBounds.bottom > viewportBottom)
      input.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    const field = this.field().nativeElement.getBoundingClientRect();
    const row = input.closest('.t-combobox-input-row')!.getBoundingClientRect();
    const panel = this.popup.overlayElement.querySelector<HTMLElement>('.t-combobox-panel');
    if (!panel) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const statusHeight = Array.from(panel.children)
      .filter((element) => element.getAttribute('role') !== 'listbox')
      .reduce((sum, element) => sum + element.getBoundingClientRect().height, 0);
    const geometryKey = [
      viewportTop,
      viewportBottom,
      inputBounds.top,
      inputBounds.bottom,
      field.left,
      field.top,
      field.bottom,
      field.width,
      row.top,
      row.bottom,
      rem,
      statusHeight,
      panel.scrollHeight,
    ];
    if (
      this.popupGeometryKey?.every((value, index) => value === geometryKey[index]) &&
      this.popupGeometryKey.length === geometryKey.length
    )
      return;
    const useRow =
      Math.max(field.top - viewportTop, viewportBottom - field.bottom) < 4 * rem + statusHeight;
    const top = useRow ? row.top : field.top,
      bottom = useRow ? row.bottom : field.bottom;
    const above = Math.max(0, top - viewportTop),
      below = Math.max(0, viewportBottom - bottom);
    const desired = Math.min(24 * rem, panel.scrollHeight);
    const flip = below < desired && above > below;
    panel.style.setProperty(
      '--t-combobox-panel-max-height',
      `${Math.max(0, Math.min(24 * rem, (flip ? above : below) - 2))}px`,
    );
    const down: ConnectedPosition = {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'top',
      offsetY: bottom - field.bottom,
    };
    const up: ConnectedPosition = {
      originX: 'start',
      originY: 'top',
      overlayX: 'start',
      overlayY: 'bottom',
      offsetY: top - field.top,
    };
    this.popupPosition!.withPositions(flip ? [up, down] : [down, up]);
    this.popup.updateSize({ width: field.width });
    this.popup.updatePosition();
    this.popupGeometryKey = geometryKey;
  }

  private inheritPopupTheme(overlay: OverlayRef): void {
    if (this.host.nativeElement.contains(overlay.overlayElement)) return;
    const styles = getComputedStyle(this.host.nativeElement);
    for (const name of Array.from(styles)) {
      if (name.startsWith('--t-combobox-'))
        overlay.overlayElement.style.setProperty(name, styles.getPropertyValue(name));
    }
    overlay.overlayElement.style.font = styles.font;
    overlay.overlayElement.style.direction = styles.direction;
  }

  protected onHostKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.tooltip?.hasAttached()) {
      this.hideTooltip();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!this.isOpen()) {
      if (
        event.key === 'Escape' &&
        event.target === this.textInput().nativeElement &&
        this.query()
      ) {
        this.changeQuery('', false);
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (
      event.key === 'Tab' ||
      event.key === 'Escape' ||
      (event.altKey && event.key === 'ArrowUp')
    ) {
      if (event.key === 'Escape' && this.popup?.overlayElement.contains(event.target as Node))
        this.textInput().nativeElement.focus();
      this.close();
      if (event.key !== 'Tab') {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }

  protected onFocusout(event: FocusEvent): void {
    const target = event.relatedTarget as Node | null;
    if (
      target &&
      (this.host.nativeElement.contains(target) || this.popup?.overlayElement.contains(target))
    )
      return;
    this.localTouched.set(true);
    this.onTouched();
  }

  private previousChipKey(): string {
    return getComputedStyle(this.host.nativeElement).direction === 'rtl'
      ? 'ArrowRight'
      : 'ArrowLeft';
  }

  protected showTooltip(chip: HTMLElement, index: number, hover = false): void {
    if (hover) this.hoveredChip = chip;
    const label = chip.querySelector<HTMLElement>('.t-combobox-chip-label')!;
    if (label.scrollWidth <= label.clientWidth) return;
    clearTimeout(this.tooltipTimer);
    if (this.tooltip?.hasAttached() && this.tooltipChip === chip) return;
    this.tooltip?.dispose();
    this.tooltipChip = chip;
    this.tooltipText.set(this.displayWith()(this.value()[index]));
    const field = this.field().nativeElement;
    const bounds = field.getBoundingClientRect(),
      anchor = chip.getBoundingClientRect();
    this.tooltip = this.overlay.create({
      width: Math.min(bounds.width, 320),
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(field)
        .withPopoverLocation('inline')
        .withPush(true)
        .withViewportMargin(4)
        .withPositions([
          {
            originX: 'start',
            originY: 'bottom',
            overlayX: 'start',
            overlayY: 'top',
            offsetX: anchor.left - bounds.left,
            offsetY: anchor.bottom - bounds.bottom,
          },
          {
            originX: 'start',
            originY: 'top',
            overlayX: 'start',
            overlayY: 'bottom',
            offsetX: anchor.left - bounds.left,
            offsetY: anchor.top - bounds.top,
          },
        ]),
    });
    this.tooltip.attach(new TemplatePortal(this.tooltipTemplate(), this.viewContainer));
    this.inheritPopupTheme(this.tooltip);
  }

  protected leaveChip(): void {
    this.hoveredChip = null;
    this.queueTooltipDismissal();
  }
  protected hoverTooltip(hovered: boolean): void {
    this.tooltipHovered = hovered;
    if (!hovered) this.queueTooltipDismissal();
    else clearTimeout(this.tooltipTimer);
  }
  protected queueTooltipDismissal(): void {
    clearTimeout(this.tooltipTimer);
    this.tooltipTimer = setTimeout(() => {
      if (
        !this.hoveredChip &&
        !this.tooltipHovered &&
        !this.tooltipChip?.contains(document.activeElement)
      )
        this.hideTooltip();
    }, 100);
  }
  private hideTooltip(): void {
    clearTimeout(this.tooltipTimer);
    this.tooltip?.detach();
    this.tooltipChip = null;
    this.tooltipHovered = false;
    this.hoveredChip = null;
  }

  protected onChipKeydown(event: KeyboardEvent, index: number): void {
    if (this.isDisabled()) return;
    if (['Enter', ' ', 'Backspace', 'Delete'].includes(event.key)) {
      event.preventDefault();
      this.removeChip(index);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const next = index + (event.key === this.previousChipKey() ? -1 : 1);
      if (next < 0) return;
      (this.removeButtons()[next] || this.textInput()).nativeElement.focus();
    }
  }

  protected listLabel(): string {
    return (
      this.ariaLabel() ||
      Array.from(this.field().nativeElement.querySelector('input')!.labels || [])
        .map((label) => label.textContent?.trim() || '')
        .join(' ')
    );
  }

  protected onCompositionStart(): void {
    this.announcer.cancelSearch();
    this.composing = true;
    this.invalidated.next();
    this.queries.next(null);
  }

  protected onCompositionEnd(event: Event): void {
    this.composing = false;
    this.onInput(event);
  }
}
