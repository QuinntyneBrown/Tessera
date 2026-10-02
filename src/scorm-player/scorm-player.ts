import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { checkIntegration } from './integration-guard';
import {
  AttemptContext,
  CourseSource,
  HostIntegration,
  PackageLimits,
  PlayerError,
  PlayerEvent,
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

  constructor() {
    effect(() => {
      const failure = checkIntegration({
        source: this.source(),
        attempt: this.attempt(),
        host: this.host(),
      });
      untracked(() => {
        this.error.set(failure);
        if (failure) {
          this.event.emit({ kind: 'error', error: failure });
        }
      });
    });
  }
}
