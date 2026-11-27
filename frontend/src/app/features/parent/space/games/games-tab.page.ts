import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { IconName } from '../../../../shared/ui/icon/icon.data';
import { SpaceContext } from '../space-context';

@Component({
  selector: 'ek-games-tab-page',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="intro"><div><p class="eyebrow">ESPACE DE {{ ctx.space()?.nomEnfant }}</p><h1>Ses jeux éducatifs</h1><p>Choisissez une activité pour consulter ou créer ses jeux.</p></div></section>
    @if (ctx.categories().length) {
      <div class="grid">
        @for (item of ctx.categories(); track item.category.id) {
          <a class="category" [routerLink]="[item.category.id]" [class]="'category tone-' + item.category.tone">
            <span class="icon"><ek-icon [name]="icons[item.category.id]" [size]="28" /></span>
            <span><strong>{{ item.category.label }}</strong><small>{{ item.category.description }}</small>
              @if (item.availability === 'demo-only') { <em>Démo navigateur</em> }
              @if (item.availability === 'no-engine') { <em>Interface de démonstration</em> }
            </span><span class="arrow">›</span>
          </a>
        }
      </div>
    } @else {
      <div class="empty"><h2>Aucune activité activée</h2><p>Activez une catégorie dans les paramètres de cet espace.</p></div>
    }
  `,
  styles: `
    :host{display:block}.intro{margin:1.5rem 0 2rem}.eyebrow{color:#8064be;font-weight:800;letter-spacing:.09em;font-size:.75rem}h1{font-size:clamp(1.7rem,4vw,2.5rem);margin:.25rem 0;color:#29233b}.intro p:last-child{color:#706b7c}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:1rem}.category{display:grid;grid-template-columns:3.5rem 1fr auto;align-items:center;gap:1rem;padding:1.25rem;border-radius:1.25rem;background:white;box-shadow:0 8px 28px #34224b12;text-decoration:none;color:#302b3b;transition:transform .18s,box-shadow .18s}.category:hover{transform:translateY(-3px);box-shadow:0 12px 32px #34224b20}.icon{height:3.5rem;width:3.5rem;border-radius:1rem;display:grid;place-items:center;background:#e9f6e9;color:#36814a}.tone-purple .icon{background:#f1eafd;color:#8254bd}.tone-blue .icon{background:#e8f2fd;color:#4679b6}.tone-yellow .icon{background:#fff5d8;color:#a57914}.category strong,.category small{display:block}.category strong{font-size:1.05rem}.category small{font-size:.85rem;color:#777181;line-height:1.45;margin-top:.35rem}.category em{display:inline-block;font-size:.72rem;color:#7158a7;background:#f4effb;padding:.25rem .5rem;border-radius:1rem;margin-top:.6rem;font-style:normal}.arrow{font-size:1.7rem;color:#a29aac}.empty{padding:2rem;background:white;border-radius:1rem;color:#706b7c}
  `,
})
export class GamesTabPage {
  protected readonly ctx = inject(SpaceContext);
  protected readonly icons: Record<string, IconName> = { maths: 'calculator', association: 'puzzle', ordonnancement: 'list-ordered', dictee: 'volume' };
}
