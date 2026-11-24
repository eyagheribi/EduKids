import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { IllustrationComponent } from '../../../../../shared/ui/illustration/illustration.component';

/**
 * STATIC DEMONSTRATION — Espaces.Api can activate « Dictee » but Activites.Api has no dictation
 * engine: nothing here is connected, every control is disabled and nothing is saved.
 */
@Component({
  selector: 'ek-dictation-preview',
  imports: [IconComponent, IllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dictation-preview.component.html',
  styleUrl: './dictation-preview.component.scss',
})
export class DictationPreviewComponent {
  readonly childName = input('l’enfant');

  protected readonly bars = [8, 14, 22, 12, 26, 18, 30, 16, 24, 10, 20, 28, 14, 22, 9, 17, 25, 12, 19, 8];
}
