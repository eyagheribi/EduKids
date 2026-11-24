import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';

/**
 * Password input with a visibility toggle, usable with Reactive Forms.
 *   <ek-password-field formControlName="motDePasse" inputId="pwd" placeholder="Votre mot de passe" />
 */
@Component({
  selector: 'ek-password-field',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PasswordFieldComponent), multi: true }],
  template: `
    <div class="ek-input-group">
      <input
        class="ek-input"
        [id]="inputId()"
        [type]="visible() ? 'text' : 'password'"
        [attr.autocomplete]="autocomplete()"
        [attr.placeholder]="placeholder()"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.aria-describedby]="describedBy() || null"
        [value]="value()"
        [disabled]="disabled()"
        (input)="onInput($event)"
        (blur)="onTouched()"
      />
      <button
        type="button"
        class="ek-icon-btn ek-input-group__action"
        (click)="visible.set(!visible())"
        [attr.aria-label]="visible() ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
        [attr.aria-pressed]="visible()"
        [disabled]="disabled()"
      >
        <ek-icon [name]="visible() ? 'eye' : 'eye-off'" [size]="22" />
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .ek-icon-btn {
      color: var(--ek-ink);
    }
  `,
})
export class PasswordFieldComponent implements ControlValueAccessor {
  readonly inputId = input('password');
  readonly placeholder = input('');
  readonly autocomplete = input<'current-password' | 'new-password'>('current-password');
  readonly invalid = input(false);
  readonly describedBy = input('');

  protected readonly visible = signal(false);
  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.onChange(value);
  }
}
