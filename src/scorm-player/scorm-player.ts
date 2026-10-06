import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  Injector,
  afterNextRender,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivityLauncher } from './runtime/activity-launcher';
import { NavigationDecision, NO_TRACKING, SequencingEngine } from './runtime/sequencing-engine';
import { correlationTokenFor } from './runtime/correlation';
import { deriveOutcome } from './runtime/outcome-calculator';
import { PersistenceCoordinator } from './runtime/persistence-coordinator';
import { CourseLoadError } from './package/course-load-error';
import { loadCourse } from './package/course-loader';
import { EDITION_LABELS } from './package/edition';
import {
  checkDelivery,
  checkIntegration,
  checkSnapshot,
  isolationUnavailable,
} from './integration-guard';
import {
  AttemptContext,
  CourseSource,
  HostIntegration,
  PackageLimits,
  PlayerError,
  PlayerEvent,
  ValidatedCourse,
  Activity,
  DeliveryDescriptor,
  ScormEdition,
  ScoSnapshot,
  CourseOutcome,
  SequencingTracking,
} from './types';

@Component({
  selector: 'tsr-scorm-player',
  imports: [NgTemplateOutlet],
  templateUrl: './scorm-player.html',
  styleUrl: './scorm-player.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScormPlayer {
  readonly source = input<CourseSource>();
  readonly attempt = input<AttemptContext>();
  readonly host = input<HostIntegration>();
  readonly limits = input<PackageLimits>();
  readonly event = output<PlayerEvent>();

  protected readonly error = signal<PlayerError | null>(null);
  protected readonly course = signal<ValidatedCourse | null>(null);
  protected readonly editionLabels = EDITION_LABELS;
  protected readonly headings = {
    integration: 'Course cannot start',
    loading: 'Course could not be loaded',
    runtime: 'Course stopped working',
    persistence: 'Progress not saved',
  };
  protected readonly activity = signal<Activity | null>(null);
  private readonly tracking = signal<SequencingTracking>(NO_TRACKING);
  private readonly engine = computed(() => {
    const course = this.course();
    return course && new SequencingEngine(course.tree, this.tracking());
  });
  protected readonly previousDecision = computed(() => this.flowDecision(-1));
  protected readonly nextDecision = computed(() => this.flowDecision(1));
  private readonly frameHost = viewChild<ElementRef<HTMLElement>>('frameHost');
  private readonly launchRequest = signal<{
    activity: Activity;
    edition: ScormEdition;
    delivery: DeliveryDescriptor;
    state: Record<string, string> | null;
  } | null>(null);
  private readonly injector = inject(Injector);
  private launcher: ActivityLauncher | null = null;
  private delivery: DeliveryDescriptor | null = null;
  private persistence: PersistenceCoordinator | null = null;
  private scoStates: Record<string, ScoSnapshot> = {};
  protected readonly saveStatus = signal('');
  /** Course-driven navigation outcomes, announced politely. */
  protected readonly navigationStatus = signal('');
  protected readonly exitWarning = signal(false);
  protected readonly outlineExpanded = signal(false);
  private readonly outlineToggle = viewChild<ElementRef<HTMLElement>>('outlineToggle');
  protected readonly loading = signal(false);
  protected readonly cancelled = signal(false);
  private loadController: AbortController | null = null;
  protected readonly outcome = signal<CourseOutcome | null>(null);
  private readonly exitHeading = viewChild<ElementRef<HTMLElement>>('exitHeading');
  private readonly activityHeading = viewChild<ElementRef<HTMLElement>>('activityHeading');
  private readonly loadRequest = signal(0);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.launcher?.dispose());
    effect(() => this.exitHeading()?.nativeElement.focus());
    effect(() => {
      const request = this.launchRequest();
      const frameHost = this.frameHost();
      if (!request || !frameHost) return;
      untracked(() => {
        this.launcher ??= new ActivityLauncher(frameHost.nativeElement, {
          onLaunchFailed: (activity) =>
            this.fail({
              category: 'loading',
              code: 'activity-unavailable',
              text: `The activity “${activity.title}” could not be loaded.`,
              retryable: true,
              correlationToken: this.token(),
            }),
          onFlush: (activity, values, terminated) => {
            this.save(activity, values);
            if (terminated) this.follow(activity, values['adl.nav.request']);
          },
          onRuntimeFailure: () =>
            this.fail({
              category: 'runtime',
              code: 'runtime-rejected',
              text: 'The activity sent data the player could not accept and stopped working correctly. Retry to restart it.',
              retryable: true,
              correlationToken: this.token(),
            }),
        });
        this.launcher.launch(request.activity, request.edition, request.delivery, request.state);
      });
    });
    effect((onCleanup) => {
      this.loadRequest();
      const source = this.source();
      const failure = checkIntegration({ source, attempt: this.attempt(), host: this.host() });
      untracked(() => {
        this.error.set(failure);
        if (failure) {
          this.event.emit({ kind: 'error', error: failure });
          return;
        }
        const controller = new AbortController();
        this.loadController = controller;
        onCleanup(() => controller.abort());
        this.course.set(null);
        this.loading.set(true);
        this.cancelled.set(false);
        loadCourse(source!, controller.signal, this.limits()).then(
          async (course) => {
            if (controller.signal.aborted) return;
            this.course.set(course);
            const delivery = await this.host()!
              .prepareDelivery(this.attempt()!, course, controller.signal)
              .catch(() => null);
            if (controller.signal.aborted) return;
            if (!delivery) return this.fail(isolationUnavailable());
            const refusal = checkDelivery(delivery, location.origin);
            if (refusal) return this.fail(refusal);
            this.delivery = delivery;
            const loaded = await this.host()!
              .loadAttempt(this.attempt()!, controller.signal)
              .then(
                (snapshot) => ({ snapshot }),
                () => null,
              );
            if (!loaded) {
              return this.fail({
                category: 'persistence',
                code: 'load-attempt-failed',
                text: 'Your saved progress could not be read, so the course was not started. Retry to read it again.',
                retryable: true,
                correlationToken: this.token(),
              });
            }
            if (controller.signal.aborted) return;
            const { snapshot } = loaded;
            const mismatch = snapshot && checkSnapshot(snapshot, this.attempt()!, course);
            if (mismatch) return this.fail(mismatch);
            this.scoStates = { ...snapshot?.scoStates };
            this.outcome.set(snapshot ? deriveOutcome(snapshot, course.tree) : null);
            const start = this.engine()!.start();
            const first =
              course.activities.find((a) => a.id === snapshot?.sequencing.currentActivityId) ??
              course.activities.find((a) => start.kind === 'launch' && a.id === start.id);
            this.loading.set(false);
            if (!first) return;
            this.tracking.set(snapshot?.sequencing.tracking ?? NO_TRACKING);
            this.deliver(first);
            this.launchRequest.set({
              activity: this.launchable(first),
              edition: course.edition,
              delivery,
              state: this.scoStates[first.id]?.values ?? null,
            });
          },
          (cause) => {
            if (!controller.signal.aborted) this.fail(this.loadingError(cause));
          },
        );
      });
    });
  }

  private save(activity: Activity, values: Record<string, string>): void {
    this.scoStates[activity.id] = { values };
    if (this.course()!.edition !== '1.2') {
      this.tracking.set(this.engine()!.reported(activity.id, values));
    }
    this.persistence ??= new PersistenceCoordinator(this.host()!, this.attempt()!, {
      onAcknowledged: ({ snapshot, revision }, upToDate) => {
        this.saveStatus.set(upToDate ? 'Progress saved' : 'Saving progress');
        if (this.error()?.category === 'persistence') this.error.set(null);
        this.event.emit({ kind: 'save', status: 'saved', revision });
        this.event.emit({ kind: 'outcome', outcome: deriveOutcome(snapshot, this.course()!.tree) });
      },
      onFailed: () => {
        this.saveStatus.set('Progress not saved');
        this.fail({
          category: 'persistence',
          code: 'save-failed',
          text: 'Your progress was not saved. Retry to save it again.',
          retryable: true,
          correlationToken: this.token(),
        });
      },
    });
    this.saveStatus.set('Saving progress');
    const snapshot = {
      schemaVersion: 1,
      context: this.attempt()!,
      edition: this.course()!.edition,
      scoStates: { ...this.scoStates },
      sequencing: {
        currentActivityId: activity.id,
        ...(this.course()!.edition !== '1.2' && { tracking: this.tracking() }),
      },
    };
    this.outcome.set(deriveOutcome(snapshot, this.course()!.tree));
    this.persistence.submit(snapshot);
  }

  /**
   * Makes the activity current. In SCORM 2004 this begins a new attempt with fresh run-time data, unless
   * the SCO suspended its last one, which then resumes; SCORM 1.2 SCOs keep their data.
   */
  private deliver(activity: Activity): void {
    const suspended = this.scoStates[activity.id]?.values['cmi.exit'] === 'suspend';
    if (this.course()!.edition === '1.2' || !suspended) {
      this.tracking.set(this.engine()!.delivered(this.activity()?.id ?? null, activity.id));
      if (this.course()!.edition !== '1.2') delete this.scoStates[activity.id];
    }
    this.activity.set(activity);
  }

  /** Acts on the navigation request a SCORM 2004 SCO left when its session ended. */
  private follow(activity: Activity, request: string | undefined): void {
    const decision = request && this.engine()!.request(activity.id, request);
    if (!decision) return;
    if (decision.kind === 'launch') {
      void this.open(
        this.course()!.activities.find((a) => a.id === decision.id)!,
        'course',
      );
    } else if (decision.kind === 'denied') {
      this.navigationStatus.set(decision.reason);
    } else if (decision.kind === 'exit') {
      this.navigationStatus.set(
        `${activity.title} has ended. Use Next or choose another activity.`,
      );
    } else {
      this.launcher!.clear();
      this.activity.set(null);
      this.navigationStatus.set(
        decision.suspended
          ? 'The course is paused. You can resume it later.'
          : 'The course has ended.',
      );
    }
  }

  /**
   * Opens another activity once the current one has delivered its final state. A learner's choice takes
   * them to the new activity's heading; a course-driven change is announced instead, unless focus was in
   * the activity being replaced, in which case focus moves to the heading, which names the change.
   */
  protected async open(activity: Activity, by: 'learner' | 'course' = 'learner'): Promise<void> {
    const focusWasInActivity = !!this.frameHost()?.nativeElement.contains(document.activeElement);
    try {
      await this.launcher!.retire();
    } catch {
      return this.fail({
        category: 'runtime',
        code: 'activity-not-responding',
        text: 'The current activity did not respond, so the course stayed on it.',
        retryable: false,
        correlationToken: this.token(),
      });
    }
    this.deliver(activity);
    this.outlineExpanded.set(false);
    const moveFocus = by === 'learner' || focusWasInActivity;
    this.navigationStatus.set(moveFocus ? '' : `Now showing ${activity.title}.`);
    if (moveFocus) {
      afterNextRender(() => this.activityHeading()?.nativeElement.focus(), {
        injector: this.injector,
      });
    }
    this.launchRequest.set({
      activity: this.launchable(activity),
      edition: this.course()!.edition,
      delivery: this.delivery!,
      state: this.scoStates[activity.id]?.values ?? null,
    });
  }

  /** Opens the chosen activity when the course rules allow it; otherwise nothing happens. */
  protected choose(activity: Activity): void {
    if (!this.unavailableReason(activity)) void this.open(activity);
  }

  protected hidden(activity: Activity): boolean {
    return this.engine()!.hidden(activity.id);
  }

  protected unavailableReason(activity: Activity): string | null {
    return this.engine()!.unavailableReason(this.activity()?.id ?? null, activity.id);
  }

  private flowDecision(direction: -1 | 1): NavigationDecision | null {
    const engine = this.engine();
    const current = this.activity();
    if (!engine || !current) return null;
    return direction > 0 ? engine.next(current.id) : engine.previous(current.id);
  }

  protected move(decision: NavigationDecision | null): void {
    if (decision?.kind !== 'launch') return;
    void this.open(this.course()!.activities.find((a) => a.id === decision.id)!);
  }

  /** For a ZIP package, points the activity at the host's delivery of the package's files. */
  private launchable(activity: Activity): Activity {
    const course = this.course()!;
    if (!course.files) return activity;
    const relative = activity.resource.url.slice(course.root.length);
    return {
      ...activity,
      resource: { ...activity.resource, url: new URL(relative, this.delivery!.courseRoot).href },
    };
  }

  protected statusText(outcome: CourseOutcome | null): string {
    return !outcome || outcome.status === 'unknown' ? 'Not yet known' : outcome.status;
  }

  protected knownText(value: string | undefined): string {
    return !value || value === 'unknown' ? 'Not yet known' : value;
  }

  protected scoreText(outcome: CourseOutcome | null): string {
    const score = outcome?.score === 'unknown' ? undefined : outcome?.score;
    return String(score?.raw ?? score?.scaled ?? 'Not yet known');
  }

  protected toggleOutline(): void {
    this.outlineExpanded.update((expanded) => !expanded);
  }

  /** Collapses the outline and, since focus was inside it, returns focus to its toggle. */
  protected collapseOutline(): void {
    this.outlineExpanded.set(false);
    this.outlineToggle()?.nativeElement.focus();
  }

  protected cancelLoad(): void {
    this.loadController?.abort();
    this.loading.set(false);
    this.cancelled.set(true);
    // A cancelled load shows nothing of the course, even if its manifest had already been read.
    this.course.set(null);
    this.activity.set(null);
  }

  protected async requestExit(): Promise<void> {
    if (await (this.persistence?.drain() ?? true)) {
      this.event.emit({ kind: 'exit', saved: true });
    } else {
      this.exitWarning.set(true);
    }
  }

  protected async retrySaveFromWarning(): Promise<void> {
    this.retry();
    if (await this.persistence!.drain()) {
      this.closeExitWarning();
      this.event.emit({ kind: 'exit', saved: true });
    }
  }

  protected exitWithoutSaving(): void {
    this.closeExitWarning();
    this.event.emit({ kind: 'exit', saved: false });
  }

  private closeExitWarning(): void {
    this.exitWarning.set(false);
    this.activityHeading()?.nativeElement.focus();
  }

  /** Identifies this attempt in diagnostics without revealing the attempt context. */
  private token(): string {
    const attempt = this.attempt();
    return attempt ? correlationTokenFor(attempt) : crypto.randomUUID();
  }

  private fail(failure: PlayerError): void {
    this.loading.set(false);
    this.error.set(failure);
    this.event.emit({ kind: 'error', error: failure });
  }

  protected retry(): void {
    if (this.error()?.category === 'persistence' && this.error()?.code === 'save-failed') {
      this.error.set(null);
      this.saveStatus.set('Saving progress');
      this.persistence!.retry();
      return;
    }
    if (
      this.error()?.code === 'activity-unavailable' ||
      this.error()?.code === 'runtime-rejected'
    ) {
      this.error.set(null);
      this.launchRequest.update((request) => request && { ...request });
      return;
    }
    this.loadRequest.update((count) => count + 1);
  }

  private loadingError(cause: unknown): PlayerError {
    const known = cause instanceof CourseLoadError;
    return {
      category: 'loading',
      code: known ? cause.code : 'load-failed',
      text: known ? cause.message : 'The course could not be loaded.',
      retryable: known ? cause.retryable : true,
      correlationToken: this.token(),
    };
  }
}
