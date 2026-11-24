import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChildContext } from '../child-context';
import { CharacterComponent } from '../../../shared/ui/character/character.component';
import { CHARACTERS } from '../../../shared/ui/character/characters';

@Component({ selector: 'ek-character-picker-page', imports: [RouterLink, CharacterComponent], changeDetection: ChangeDetectionStrategy.OnPush, template: `
  <a class="back" routerLink="/enfant">‹ Retour</a><header><p>MON PETIT COMPAGNON</p><h1>Choisis ton personnage !</h1><span>Il t’accompagnera dans tes jeux.</span></header>
  <div class="grid">@for(character of characters;track character.key){<button type="button" class="card" [class.selected]="ctx.space()?.personnagePrefere===character.key" (click)="choose(character.key)"><ek-character [key]="character.key" [size]="92" [framed]="true"/><strong>{{character.name}}</strong><small>{{character.tagline}}</small>@if(ctx.space()?.personnagePrefere===character.key){<b>✓ C’est moi !</b>}</button>}</div>@if(message()){<p class="message">{{message()}}</p>}
`, styles: `:host{display:block;max-width:960px;margin:auto}.back{color:#7659a2;text-decoration:none;font-weight:800}header{text-align:center;padding:1rem;color:#766e80}header p{color:#835fb9;font-size:.8rem;font-weight:850;letter-spacing:.1em}h1{font-size:2.4rem;color:#332b43;margin:.3rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem}.card{display:flex;align-items:center;flex-direction:column;gap:.6rem;padding:1.2rem;border:2px solid transparent;border-radius:1.3rem;background:white;box-shadow:0 8px 24px #30214512;color:#3b3348;font:inherit;cursor:pointer}.card:hover,.card.selected{border-color:#a886d6;transform:translateY(-2px)}.card strong{font-size:1.1rem}.card small{color:#81798a}.card b{color:#6d9e4e}.message{text-align:center;color:#755aa4;font-weight:700}` })
export class CharacterPickerPage {
  protected readonly ctx = inject(ChildContext);
  protected readonly characters = CHARACTERS;
  protected readonly message = signal('');
  protected choose(key: string): void {
    this.message.set('');
    this.ctx.chooseCharacter(key).subscribe({ next: () => this.message.set(this.ctx.demoMode() ? 'Ton personnage est prêt dans la démo !' : 'Ton personnage est enregistré !'), error: () => this.message.set('Impossible d’enregistrer pour le moment. Réessaie quand le service est disponible.') });
  }
}
