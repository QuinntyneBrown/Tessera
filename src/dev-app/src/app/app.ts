import { Component } from '@angular/core';
import { ScormPlayerOverviewExample } from '../../../components-examples/tessera/scorm-player';
import { ComboboxExamples } from '../../../components-examples/tessera/combobox';

@Component({
  imports: [ScormPlayerOverviewExample, ComboboxExamples],
  selector: 'tsr-root',
  template: `
    <main>
      <h1>Tessera dev app</h1>
      <tsr-scorm-player-overview-example />
      <tsr-combobox-examples />
    </main>
  `,
})
export class App {}
