import { Component } from '@angular/core';
import { ScormPlayerOverviewExample } from '../../../components-examples/tessera/scorm-player';
import { ComboboxExamples } from '../../../components-examples/tessera/combobox';
import { ThemeExample } from '../../../components-examples/tessera/theme/theme-example';

@Component({
  imports: [ScormPlayerOverviewExample, ComboboxExamples, ThemeExample],
  selector: 'tsr-root',
  template: `
    <main>
      <h1>Tessera dev app</h1>
      <tsr-theme-example><tsr-scorm-player-overview-example /></tsr-theme-example>
      <tsr-combobox-examples />
    </main>
  `,
})
export class App {}
