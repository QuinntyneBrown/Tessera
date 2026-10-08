import '@angular/compiler';
import { Component, getPlatform, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import {
  ComponentHarness,
  ComponentHarnessConstructor,
  manualChangeDetection,
} from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import * as api from '@tessera/video-player';
import { FixtureVideoStreamTransport } from './fixture-video-stream-transport';

/** The harness API as the contract expects it; resolved at run time so a missing export reports. */
interface ContractHarness {
  getState(): Promise<string>;
  play(): Promise<void>;
  pause(): Promise<void>;
  toggleMute(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getVolume(): Promise<number>;
  toggleCaptions(): Promise<void>;
  areCaptionsShowing(): Promise<boolean>;
  isLive(): Promise<boolean>;
  goToLive(): Promise<void>;
  getStatusText(): Promise<string>;
  getErrorMessage(): Promise<string | null>;
  retry(): Promise<void>;
  isMuted(): Promise<boolean>;
}

@Component({
  imports: [api.VideoPlayer],
  providers: [
    {
      provide: api.VIDEO_STREAM_TRANSPORT,
      useFactory: () => new FixtureVideoStreamTransport(new URLSearchParams('scenario=live')),
    },
  ],
  template: `
    <t-video-player
      hubUrl="https://hub.example/hubs/video"
      streamId="harness-stream"
      [captions]="{ src: '/captions-en.vtt', srclang: 'en', label: 'English' }"
    />
  `,
})
class HarnessHost {}

let initialized = false;

/** Browser-only contract run against real media; waits poll the public state. */
export async function runHarnessContract(): Promise<unknown> {
  const constructor = (api as unknown as Record<string, unknown>)['VideoPlayerHarness'] as
    ComponentHarnessConstructor<ComponentHarness> | undefined;
  if (!constructor) return { error: 'VideoPlayerHarness unavailable' };
  if (!initialized) {
    TestBed.initTestEnvironment(BrowserTestingModule, getPlatform() || platformBrowserTesting());
    initialized = true;
  }
  await TestBed.configureTestingModule({
    imports: [HarnessHost],
    providers: [provideZonelessChangeDetection()],
  }).compileComponents();
  const fixture = TestBed.createComponent(HarnessHost);
  fixture.detectChanges();
  try {
    return await manualChangeDetection(async () => {
      const harness = (await TestbedHarnessEnvironment.loader(fixture).getHarness(
        constructor,
      )) as unknown as ContractHarness;
      const until = (state: string) =>
        waitFor(fixture, async () => (await harness.getState()) === state);
      const report: Record<string, unknown> = {};
      await until('live');
      report['initial'] = await harness.getState();
      await harness.pause();
      await until('paused');
      report['paused'] = await harness.getState();
      await harness.play();
      await until('live');
      report['resumed'] = await harness.getState();
      await harness.toggleMute();
      fixture.detectChanges();
      report['muted'] = await harness.isMuted();
      await harness.setVolume(40);
      fixture.detectChanges();
      report['volume'] = await harness.getVolume();
      await harness.toggleCaptions();
      fixture.detectChanges();
      report['captions'] = await harness.areCaptionsShowing();
      await harness.goToLive();
      report['live'] = await harness.isLive();
      window.__videoFixture.drop();
      await until('reconnecting');
      report['reconnectingStatus'] = await harness.getStatusText();
      window.__videoFixture.restore();
      await until('live');
      window.__videoFixture.fail();
      await until('error');
      report['errorMessage'] = await harness.getErrorMessage();
      await harness.retry();
      await waitFor(fixture, async () => (await harness.getErrorMessage()) === null);
      report['retried'] = ['connecting', 'live'].includes(await harness.getState());
      return report;
    });
  } catch (error) {
    return { error: String(error) };
  } finally {
    fixture.destroy();
    TestBed.resetTestingModule();
  }
}

async function waitFor(
  fixture: ComponentFixture<unknown>,
  condition: () => Promise<boolean>,
): Promise<void> {
  const deadline = performance.now() + 20000;
  for (;;) {
    fixture.detectChanges();
    if (await condition()) return;
    if (performance.now() > deadline) throw new Error('Harness contract timed out');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
