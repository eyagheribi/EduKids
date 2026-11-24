import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icon.data';

let dialogTitleCounter = 0;

/**
 * Visual frame for dialogs opened with the CDK `Dialog` service (see openDialog()).
 *   <ek-dialog-shell title="Modifier l'espace" icon="pencil">
 *     …body…
 *     <div footer>…buttons…</div>
 *   </ek-dialog-shell>
 */
@Component({
  selector: 'ek-dialog-shell',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      @if (icon()) {
        <span class="icon" [class.danger]="tone() === 'danger'"><ek-icon [name]="icon()!" [size]="22" /></span>
      }
      <h2 [id]="titleId">{{ title() }}</h2>
      @if (closable()) {
        <button type="button" class="ek-icon-btn close" (click)="close()" aria-label="Fermer">
          <ek-icon name="x" [size]="22" />
        </button>
      }
    </header>
    <div class="body"><ng-content /></div>
    <footer><ng-content select="[footer]" /></footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      width: min(var(--dialog-width, 560px), calc(100vw - 32px));
      max-height: calc(100vh - 32px);
      overflow: hidden;
      border-radius: var(--ek-radius-xl);
      background: #fff;
      box-shadow: var(--ek-shadow-lg);
      animation: ek-pop 220ms var(--ek-ease) both;
    }
    header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1.25rem 1.25rem 0.5rem 1.5rem;
    }
    h2 {
      flex: 1;
      font-size: 1.35rem;
    }
    .icon {
      display: grid;
      place-items: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 14px;
      background: var(--ek-purple-50);
      color: var(--ek-purple-600);
    }
    .icon.danger {
      background: var(--ek-red-50);
      color: var(--ek-red-500);
    }
    .body {
      padding: 0.75rem 1.5rem 1rem;
      overflow-y: auto;
    }
    footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 0.75rem 1.5rem 1.5rem;
    }
    footer:empty {
      display: none;
    }
  `,
  host: { role: 'document', '[attr.aria-labelledby]': 'titleId' },
})
export class DialogShellComponent {
  readonly title = input.required<string>();
  readonly icon = input<IconName | null>(null);
  readonly tone = input<'default' | 'danger'>('default');
  readonly closable = input(true);

  protected readonly titleId = `ek-dialog-title-${++dialogTitleCounter}`;
  private readonly ref = inject(DialogRef, { optional: true });

  close(): void {
    this.ref?.close();
  }
}
