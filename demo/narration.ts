import { Page } from '@playwright/test';

export interface Chapter {
  title: string;
  /** Seconds from the start of capture. */
  at: number;
}

const STYLE = `
  #demo-caption {
    position: fixed; left: 50%; top: 14px; transform: translateX(-50%);
    max-width: 46rem; padding: 10px 18px; border-radius: 10px;
    background: rgba(17, 24, 39, 0.92); color: #fff; font: 600 19px/1.35 system-ui, sans-serif;
    text-align: center; z-index: 2147483647; pointer-events: none;
  }
  #demo-caption.bottom { top: auto; bottom: 14px; }
  #demo-card {
    position: fixed; inset: 0; display: grid; place-content: center; gap: 10px; text-align: center;
    background: #111827; color: #fff; font-family: system-ui, sans-serif; z-index: 2147483647;
    pointer-events: none;
  }
  #demo-card h1 { margin: 0; font-size: 44px; }
  #demo-card p { margin: 0; font-size: 22px; color: #d1d5db; }
`;

/** Opening cards, chapter cards and captions, kept apart from the application and always non-interactive. */
export class Narrator {
  readonly chapters: Chapter[] = [];
  readonly markers: Record<string, number> = {};
  private readonly startedAt = Date.now();

  constructor(private readonly page: Page) {}

  private get elapsed(): number {
    return (Date.now() - this.startedAt) / 1000;
  }

  private async install(): Promise<void> {
    await this.page.evaluate((css) => {
      if (document.getElementById('demo-style')) return;
      const style = document.createElement('style');
      style.id = 'demo-style';
      style.textContent = css;
      document.head.append(style);
    }, STYLE);
  }

  /** Records a named moment on the capture timeline (for example, the poster). */
  mark(name: string): void {
    this.markers[name] = this.elapsed;
  }

  async card(title: string, subtitle: string, ms = 3500): Promise<void> {
    await this.install();
    await this.page.evaluate(
      ([heading, text]) => {
        const card = document.createElement('div');
        card.id = 'demo-card';
        const h1 = document.createElement('h1');
        h1.textContent = heading;
        const p = document.createElement('p');
        p.textContent = text;
        card.append(h1, p);
        document.body.append(card);
      },
      [title, subtitle],
    );
    await this.page.waitForTimeout(ms);
    await this.page.evaluate(() => document.getElementById('demo-card')?.remove());
  }

  /** Starts a chapter: a title card whose appearance time is recorded. */
  async chapter(title: string, subtitle: string): Promise<void> {
    this.chapters.push({ title, at: this.elapsed });
    await this.card(title, subtitle, 3000);
  }

  async caption(text: string, ms = 5000, at: 'top' | 'bottom' = 'top'): Promise<void> {
    await this.install();
    await this.page.evaluate(
      ([message, position]) => {
        document.getElementById('demo-caption')?.remove();
        const caption = document.createElement('div');
        caption.id = 'demo-caption';
        caption.className = position;
        caption.textContent = message;
        document.body.append(caption);
      },
      [text, at],
    );
    await this.page.waitForTimeout(ms);
  }

  async clearCaption(): Promise<void> {
    await this.page.evaluate(() => document.getElementById('demo-caption')?.remove());
  }
}
