import { Component } from '@angular/core';
import { ScormPlayerOverviewExample } from '../../../components-examples/tessera/scorm-player';

@Component({
  imports: [ScormPlayerOverviewExample],
  selector: 'tsr-root',
  template: `
    <main>
      <h1>Tessera dev app</h1>
      <tsr-scorm-player-overview-example />
    </main>
  `,
})
export class App {}
