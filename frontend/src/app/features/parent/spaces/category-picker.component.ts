import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ACTIVATABLE_CATEGORIES, CategoryDef } from '../../../core/models/categories';
import { EspacesActivite } from '../../../core/models/espaces.models';
import { CategoryIconComponent } from '../../../shared/ui/category-icon/category-icon.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { CATEGORY_TAGLINES, toggleActivite } from './space-form';

/**
 * Selectable category tiles (checkboxes) bound to a list of Espaces.Api activities.
 *   <fieldset><legend>…</legend><ek-category-picker formControlName="activites" /></fieldset>
 * Only categories with an Espaces.Api key can be picked; Dictée is flagged « Démo statique ».
 */
@Component({
  selector: 'ek-category-picker',
  imports: [CategoryIconComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CategoryPickerComponent), multi: true }],
  template: `
    @for (cat of categories(); track cat.id) {
      @if (cat.espacesKey; as key) {
        <label class="ek-choice tile" [class.is-selected]="selected().includes(key)" [class.is-disabled]="disabled()">
          <input
            type="checkbox"
            [checked]="selected().includes(key)"
            [disabled]="disabled()"
            [attr.aria-describedby]="describedBy() || null"
            [attr.aria-invalid]="invalid() || null"
            (change)="toggle(key)"
            (blur)="touched()"
          />
          <span class="ek-choice__check" aria-hidden="true">
            @if (selected().includes(key)) {
              <ek-icon name="check" [size]="14" [strokeWidth]="3.4" />
            }
          </span>
          <ek-category-icon [category]="cat.id" [size]="compact() ? 40 : 50" />
          <span class="name">{{ cat.label }}</span>
          @if (!compact()) {
            <span class="tagline">{{ taglines[cat.id] }}</span>
          }
          @if (cat.gameType === null) {
            <span class="ek-chip ek-chip--yellow ek-chip--sm" title="Aucun moteur de dictée n’existe encore : aperçu non connecté">
              <ek-icon name="flask" [size]="12" /> Démo statique
            </span>
          }
        </label>
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--tile-min, 150px), 1fr));
      gap: 0.85rem;
    }
    :host([data-compact]) {
      --tile-min: 130px;
    }
    .tile {
      align-content: start;
      min-height: 100%;
      padding: 1.1rem 0.75rem 0.95rem;
      border-radius: 20px;
      gap: 0.35rem;
    }
    :host([data-compact]) .tile {
      padding: 0.9rem 0.6rem 0.8rem;
    }
    ek-category-icon {
      margin-bottom: 0.2rem;
      transition: transform var(--ek-duration) var(--ek-ease-bounce);
    }
    .tile:hover ek-category-icon,
    .tile.is-selected ek-category-icon {
      transform: scale(1.06) rotate(-3deg);
    }
    .name {
      font-family: var(--ek-font-display);
      font-size: 1.05rem;
      font-weight: 600;
      line-height: 1.2;
    }
    .tagline {
      color: var(--ek-text-soft);
      font-size: 0.82rem;
      font-weight: 600;
      line-height: 1.3;
    }
    .ek-chip {
      margin-top: 0.15rem;
    }
  `,
  host: { role: 'group', '[attr.data-compact]': 'compact() || null' },
})
export class CategoryPickerComponent implements ControlValueAccessor {
  /** Categories offered (default: every category Espaces.Api accepts). */
  readonly categories = input<readonly CategoryDef[]>(ACTIVATABLE_CATEGORIES);
  readonly compact = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');

  protected readonly selected = signal<readonly EspacesActivite[]>([]);
  protected readonly disabled = signal(false);
  protected readonly taglines = CATEGORY_TAGLINES;

  private onChange: (value: EspacesActivite[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: readonly EspacesActivite[] | null): void {
    this.selected.set(value ?? []);
  }

  registerOnChange(fn: (value: EspacesActivite[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected toggle(key: EspacesActivite): void {
    const next = toggleActivite(this.selected(), key);
    this.selected.set(next);
    this.onChange(next);
    this.onTouched();
  }

  protected touched(): void {
    this.onTouched();
  }
}
