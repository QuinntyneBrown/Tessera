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
  protected readonly activity = signal<Activity | null>(null);
  private readonly frameHost = viewChild<ElementRef<HTMLElement>>('frameHost');
  private readonly launchRequest = signal<{
    activity: Activity;
    edition: ScormEdition;
    delivery: DeliveryDescriptor;
  } | null>(null);
  private launcher: ActivityLauncher | null = null;
  private readonly loadRequest = signal(0);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.launcher?.dispose());
    effect(() => {
      const request = this.launchRequest();
      const frameHost = this.frameHost();
      if (!request || !frameHost) return;
      untracked(() => {
        this.launcher ??= new ActivityLauncher(frameHost.nativeElement, (activity) =>
          this.fail({
            category: 'loading',
            code: 'activity-unavailable',
            text: `The activity “${activity.title}” could not be loaded.`,
            retryable: true,
            correlationToken: crypto.randomUUID(),
          }),
        );
        this.launcher.launch(request.activity, request.edition, request.delivery);
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
            const first = course.activities[0];
            this.activity.set(first);
            this.launchRequest.set({ activity: first, edition: course.edition, delivery });
          },
          (cause) => {
            if (!controller.signal.aborted) this.fail(this.loadingError(cause));
          },
        );
      });
    });
  }

  private fail(failure: PlayerError): void {
    this.error.set(failure);
    this.event.emit({ kind: 'error', error: failure });
  }

  protected retry(): void {
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
