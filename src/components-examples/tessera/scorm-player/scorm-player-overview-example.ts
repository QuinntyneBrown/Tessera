import { Component, signal } from '@angular/core';
import {
  AttemptContext,
  AttemptSnapshot,
  CourseSource,
  HostIntegration,
  PlayerEvent,
  ScormPlayer,
} from '@tessera/scorm-player';

/** Where the LMS serves the player's wrapper and the course from; it must differ from the LMS origin. */
const COURSE_ORIGIN = 'http://127.0.0.1:4300';

/**
 * A minimal host: an extracted course, an attempt issued by the LMS, and in-memory persistence.
 * A real LMS authorizes every call and stores snapshots durably before it acknowledges a save.
 */
@Component({
  selector: 'tsr-scorm-player-overview-example',
  imports: [ScormPlayer],
  template: `
    <tsr-scorm-player [source]="source" [attempt]="attempt" [host]="host" (event)="log($event)" />
    <h2>Events the host received</h2>
    <ol>
      @for (entry of events(); track $index) {
        <li>{{ entry }}</li>
      }
    </ol>
  `,
})
export class ScormPlayerOverviewExample {
  protected readonly events = signal<string[]>([]);
  private saved: AttemptSnapshot | null = null;

  protected readonly source: CourseSource = {
    kind: 'manifest',
    manifestUrl: `${COURSE_ORIGIN}/courses/multi-sco-12/imsmanifest.xml`,
  };

  protected readonly attempt: AttemptContext = {
    attemptKey: 'example-attempt',
    courseKey: 'multi-sco-12',
    courseRevision: '1',
  };

  protected readonly host: HostIntegration = {
    loadAttempt: async () => this.saved,
    saveState: async (_context, submission) => {
      this.saved = submission.snapshot;
      return { revision: submission.revision };
    },
    prepareDelivery: async () => ({
      courseRoot: `${COURSE_ORIGIN}/courses/multi-sco-12/`,
      wrapperUrl: `${COURSE_ORIGIN}/wrapper/wrapper.html`,
      bridgeProtocolVersion: 1,
    }),
  };

  protected log(event: PlayerEvent): void {
    this.events.update((events) => [...events, `${event.kind}`]);
  }
}
