import { ElementRef, Injectable, inject } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';

/** Keeps the non-popover fallback inside its own native modal dialog. */
@Injectable()
export class ComboboxOverlayContainer extends OverlayContainer {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected override _createContainer(): void {
    super._createContainer();
    const dialog = this.host.nativeElement.closest('dialog[open]');
    if (dialog) dialog.appendChild(this._containerElement!);
  }
}
