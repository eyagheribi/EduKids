import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChildContext } from '../child-context';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { IconName } from '../../../shared/ui/icon/icon.data';

@Component({
  selector: 'ek-child-home-page', imports: [RouterLink, IconComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="welcome"><span class="sun">☀</span><p>Salut {{ ctx.firstName() }} !</p><h1>On joue et on apprend ?</h1><span>Choisis une activité pour commencer.</span></section>
    @if (ctx.error()) { <div class="message"><strong>Impossible de charger ton espace</strong><p>Réessaie dans un instant. Si le problème continue, demande de l’aide à ton parent.</p><button type="button" (click)="ctx.load(true)">Réessayer</button></div> }
    @if (ctx.loading()) { <p class="message">Préparation de tes activités…</p> }
    <div class="grid">@for (item of ctx.categories(); track item.category.id) {
      <a class="card" [routerLink]="['/enfant/categories', item.category.id]" [class]="'card tone-' + item.category.tone">
        <span class="icon"><ek-icon [name]="icons[item.category.id]" [size]="30"/></span><strong>{{ item.category.childLabel }}</strong><span>{{ item.category.childDescription }}</span>
        @if (item.availability !== 'active') { <small>Activité de démonstration</small> }
      </a>
    }</div>
    @if (!ctx.loading() && !ctx.error() && !ctx.categories().length) { <div class="message">Ton parent n’a pas encore activé d’activité. Demande-lui d’en choisir une.</div> }
  `,
  styles: `:host{display:block}.welcome{text-align:center;padding:2rem 1rem 2.5rem;color:#665e76}.sun{font-size:2.6rem;color:#f3bd42}.welcome p{margin:.4rem 0;color:#7864a8;font-weight:800}.welcome h1{font-size:clamp(2rem,5vw,3.3rem);color:#322942;margin:.3rem 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:1.25rem}.card{display:flex;min-height:205px;flex-direction:column;align-items:center;justify-content:center;gap:.7rem;text-align:center;text-decoration:none;color:#383147;background:#fff;border-radius:1.6rem;padding:1.4rem;box-shadow:0 10px 30px #30214512;transition:transform .2s}.card:hover{transform:translateY(-5px) rotate(-.5deg)}.icon{height:4.2rem;width:4.2rem;border-radius:1.3rem;display:grid;place-items:center;background:#e8f6e8;color:#38864d}.tone-purple .icon{background:#f1e9ff;color:#8155bd}.tone-blue .icon{background:#e8f2fe;color:#477dbd}.tone-yellow .icon{background:#fff3d2;color:#a17b21}.card strong{font-size:1.4rem;font-family:var(--ek-font-display)}.card>span:last-of-type{color:#777183}.card small{color:#8261b6;background:#f6f1fc;padding:.3rem .6rem;border-radius:1rem}.message{max-width:650px;margin:1rem auto;padding:1rem 1.25rem;border-radius:1rem;background:white;color:#726b7c}.message strong{color:#3c344a}.message button{border:0;border-radius:2rem;padding:.6rem 1rem;background:#7956b5;color:white;font-weight:700}`,
})
export class ChildHomePage {
  protected readonly ctx = inject(ChildContext);
  protected readonly icons: Record<string, IconName> = { maths:'calculator', association:'puzzle', ordonnancement:'list-ordered', dictee:'volume' };
}
