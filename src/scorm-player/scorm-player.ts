import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CourseLoadError } from './package/course-load-error';
import { loadCourse } from './package/course-loader';
import { checkIntegration } from './integration-guard';
import {
  AttemptContext,
  CourseSource,
  HostIntegration,
  PackageLimits,
  PlayerError,
  PlayerEvent,
  ValidatedCourse,
} from './types';

const EDITION_LABELS = {
  '1.2': 'SCORM 1.2',
  '2004-2nd': 'SCORM 2004 2nd Edition',
  '2004-3rd': 'SCORM 2004 3rd Edition',
  '2004-4th': 'SCORM 2004 4th Edition',
} as const;

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
  private readonly loadRequest = signal(0);

  constructor() {
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
          (course) => this.course.set(course),
          (cause) => {
            if (controller.signal.aborted) return;
            const failure = this.loadingError(cause);
            this.error.set(failure);
            this.event.emit({ kind: 'error', error: failure });
          },
        );
      });
    });
  }

  protected retry(): void {
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
