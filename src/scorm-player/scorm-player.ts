import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivityLauncher } from './runtime/activity-launcher';
import { PersistenceCoordinator } from './runtime/persistence-coordinator';
import { CourseLoadError } from './package/course-load-error';
import { loadCourse } from './package/course-loader';
import { EDITION_LABELS } from './package/edition';
import { checkDelivery, checkIntegration, isolationUnavailable } from './integration-guard';
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
} from './types';

@Component({
  selector: 'tsr-scorm-player',
  templateUrl: './scorm-player.html',
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
  private readonly frameHost = viewChild<ElementRef<HTMLElement>>('frameHost');
  private readonly launchRequest = signal<{
    activity: Activity;
    edition: ScormEdition;
    delivery: DeliveryDescriptor;
    state: Record<string, string> | null;
  } | null>(null);
  private launcher: ActivityLauncher | null = null;
  private persistence: PersistenceCoordinator | null = null;
  private scoStates: Record<string, ScoSnapshot> = {};
  protected readonly saveStatus = signal('');
  protected readonly exitWarning = signal(false);
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
              correlationToken: crypto.randomUUID(),
            }),
          onFlush: (activity, values) => this.save(activity, values),
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
        onCleanup(() => controller.abort());
        this.course.set(null);
        loadCourse(source!, controller.signal).then(
          async (course) => {
            this.course.set(course);
            const delivery = await this.host()!
              .prepareDelivery(this.attempt()!, course, controller.signal)
              .catch(() => null);
            if (!delivery) return this.fail(isolationUnavailable());
            const refusal = checkDelivery(delivery, location.origin);
            if (refusal) return this.fail(refusal);
            const snapshot = await this.host()!.loadAttempt(this.attempt()!, controller.signal);
            this.scoStates = { ...snapshot?.scoStates };
            const first =
              course.activities.find((a) => a.id === snapshot?.sequencing.currentActivityId) ??
              course.activities[0];
            this.activity.set(first);
            this.launchRequest.set({
              activity: first,
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
    this.persistence ??= new PersistenceCoordinator(this.host()!, this.attempt()!, {
      onAcknowledged: (revision, upToDate) => {
        this.saveStatus.set(upToDate ? 'Progress saved' : 'Saving progress');
        if (this.error()?.category === 'persistence') this.error.set(null);
        this.event.emit({ kind: 'save', status: 'saved', revision });
      },
      onFailed: () => {
        this.saveStatus.set('Progress not saved');
        this.fail({
          category: 'persistence',
          code: 'save-failed',
          text: 'Your progress was not saved. Retry to save it again.',
          retryable: true,
          correlationToken: crypto.randomUUID(),
        });
      },
    });
    this.saveStatus.set('Saving progress');
    this.persistence.submit({
      schemaVersion: 1,
      context: this.attempt()!,
      edition: this.course()!.edition,
      scoStates: { ...this.scoStates },
      sequencing: { currentActivityId: activity.id },
    });
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

  private fail(failure: PlayerError): void {
    this.error.set(failure);
    this.event.emit({ kind: 'error', error: failure });
  }

  protected retry(): void {
    if (this.error()?.category === 'persistence') {
      this.error.set(null);
      this.saveStatus.set('Saving progress');
      this.persistence!.retry();
      return;
    }
    if (this.error()?.code === 'activity-unavailable') {
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
      correlationToken: crypto.randomUUID(),
    };
  }
}
