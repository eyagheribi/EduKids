import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// STUB — replaced by the feature implementation.
@Component({
  selector: 'ek-space-shell',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="ek-muted">Espace enfant (en construction)</p><router-outlet />`,
})
export class SpaceShellComponent {}
