import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameDto } from '../../../../../core/models/activites.models';
import { CategoryTone } from '../../../../../core/models/categories';
import { FullDatePipe } from '../../../../../shared/pipes/format.pipes';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { gameTitle, pluralize, relativeDatePhrase, summarizeGame, wasModified } from './game-list.utils';

/** One game of the parent list: title, content preview, dates and actions. */
@Component({
  selector: 'ek-game-card',
  imports: [RouterLink, IconComponent, FullDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
  host: { '[attr.data-tone]': 'tone()', '[class.is-busy]': 'deleting()' },
})
export class GameCardComponent {
  readonly game = input.required<GameDto>();
  readonly tone = input<CategoryTone>('purple');
  /** Absolute link of the edit page. */
  readonly editLink = input.required<string>();
  readonly deleting = input(false);

  readonly history = output<GameDto>();
  readonly remove = output<GameDto>();

  protected readonly title = computed(() => gameTitle(this.game()));
  protected readonly untitled = computed(() => !this.game().title?.trim());
  protected readonly summary = computed(() => summarizeGame(this.game()));
  protected readonly modified = computed(() => wasModified(this.game()));
  protected readonly created = computed(() => relativeDatePhrase(this.game().createdAt));
  protected readonly updated = computed(() => relativeDatePhrase(this.game().updatedAt));
  protected readonly headingId = computed(() => `ek-game-${this.game().id}`);

  protected readonly plural = pluralize;
}
