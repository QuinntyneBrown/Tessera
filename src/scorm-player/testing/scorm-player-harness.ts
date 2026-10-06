import { ComponentHarness, TestElement } from '@angular/cdk/testing';

/** An outline activity as the learner sees it. */
export interface ScormPlayerActivityState {
  title: string;
  /** Whether it is the activity on screen. */
  current: boolean;
  /** Whether the course rules let the learner open it now. */
  available: boolean;
  /** Why it is unavailable, as shown to the learner; null when available. */
  reason: string | null;
}

/** An error the player shows, with its heading and learner-facing text. */
export interface ScormPlayerErrorState {
  heading: string;
  text: string;
}

/**
 * Consumer test API for `tsr-scorm-player`. It reads and operates the player's own controls only; course
 * content runs in an isolated frame that the harness does not reach. Loading is asynchronous, so poll
 * `getCourseTitle` until it returns the title before operating the course.
 */
export class ScormPlayerHarness extends ComponentHarness {
  static hostSelector = 'tsr-scorm-player';
  private readonly title = this.locatorForOptional('h1');
  private readonly outlineButtons = this.locatorForAll('nav[aria-label="Course outline"] button');
  private readonly outcomeLines = this.locatorForAll('[aria-label="Course outcome"] p');
  private readonly saveStatus = this.locatorForOptional('.player [role="status"]');
  private readonly alert = this.locatorForOptional('[role="alert"]');
  private readonly alertHeading = this.locatorForOptional('[role="alert"] h2');
  private readonly alertText = this.locatorForOptional('[role="alert"] p');

  /** The course title, or null while the course is loading or could not be loaded. */
  async getCourseTitle(): Promise<string | null> {
    return (await (await this.title())?.text())?.trim() ?? null;
  }

  async getActivities(): Promise<ScormPlayerActivityState[]> {
    return Promise.all(
      (await this.outlineButtons()).map(async (button) => {
        const reason = await this.reasonFor(button);
        return {
          title: (await button.text()).trim(),
          current: (await button.getAttribute('aria-current')) === 'step',
          available: (await button.getAttribute('aria-disabled')) !== 'true',
          reason,
        };
      }),
    );
  }

  /** Activates the outline entry with this title; an unavailable activity does not open. */
  async chooseActivity(title: string): Promise<void> {
    const buttons = await this.outlineButtons();
    const titles = await Promise.all(buttons.map(async (button) => (await button.text()).trim()));
    const index = titles.indexOf(title);
    if (index < 0) throw new Error(`ScormPlayerHarness: activity "${title}" was not found.`);
    await buttons[index].click();
  }

  /** The title of the activity on screen, or null when none is. */
  async getCurrentActivity(): Promise<string | null> {
    const current = (await this.getActivities()).find((activity) => activity.current);
    return current?.title ?? null;
  }

  async next(): Promise<void> {
    await (await this.flowButton('Next')).click();
  }

  async previous(): Promise<void> {
    await (await this.flowButton('Previous')).click();
  }

  /** Why Next or Previous is blocked, as shown to the learner; null when it is available. */
  async getNavigationReason(control: 'Next' | 'Previous'): Promise<string | null> {
    return this.reasonFor(await this.flowButton(control));
  }

  /** The course outcome as shown, by label: Status or Completion and Success, and Score. */
  async getOutcome(): Promise<Record<string, string>> {
    const outcome: Record<string, string> = {};
    for (const line of await this.outcomeLines()) {
      const [label, value] = (await line.text()).split(/:\s*/, 2);
      outcome[label.trim()] = value.trim();
    }
    return outcome;
  }

  /** The save status text, e.g. "Progress saved"; empty before the first save. */
  async getSaveStatus(): Promise<string> {
    return (await (await this.saveStatus())?.text())?.trim() ?? '';
  }

  /** The error the player shows, or null when it shows none. */
  async getError(): Promise<ScormPlayerErrorState | null> {
    if (!(await this.alert())) return null;
    return {
      heading: (await (await this.alertHeading())!.text()).trim(),
      text: (await (await this.alertText())!.text()).trim(),
    };
  }

  async retry(): Promise<void> {
    await (await this.button('Retry')).click();
  }

  async exit(): Promise<void> {
    await (await this.button('Exit course')).click();
  }

  private async flowButton(label: 'Next' | 'Previous'): Promise<TestElement> {
    return this.button(label);
  }

  private async button(label: string): Promise<TestElement> {
    for (const button of await this.locatorForAll('button')()) {
      if ((await button.text()).trim() === label) return button;
    }
    throw new Error(`ScormPlayerHarness: the "${label}" control is not shown.`);
  }

  private async reasonFor(button: TestElement): Promise<string | null> {
    const id = await button.getAttribute('aria-describedby');
    if (!id) return null;
    const reason = await this.locatorForOptional(`[id="${id}"]`)();
    return (await reason?.text())?.trim() ?? null;
  }
}
