import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ChildDashboardBadge } from './child-dashboard-demo.service';

@Component({
  selector: 'ek-child-badges',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="badges-card" id="mes-badges" aria-labelledby="badges-title">
      <header class="badges-heading">
        <ek-icon name="award" [size]="25" />
        <h2 id="badges-title">Mes badges</h2>
        <span class="demo-label">Démo</span>
      </header>
      <div class="badges-list">
        @for (badge of badges(); track badge.id) {
          <article class="badge" [class.badge--locked]="!badge.unlocked" [attr.aria-label]="badge.title + (badge.unlocked ? ' débloqué' : ' verrouillé')">
            <span class="badge__seal">
              <ek-icon [name]="badge.icon" [size]="25" />
              @if (badge.unlocked) { <span class="badge__check"><ek-icon name="check" [size]="12" /></span> }
              @else { <span class="badge__lock"><ek-icon name="lock" [size]="12" /></span> }
            </span>
            <strong>{{ badge.title }}</strong>
          </article>
        }
      </div>
      <p class="disclaimer">Badges d’exemple uniquement : aucune progression n’est enregistrée.</p>
    </section>
  `,
  styles: `
    :host { display: block; }
    .badges-card { padding: .9rem 1rem; border: 1px solid #e1d5f7; border-radius: 21px; background: rgba(255,255,255,.88); box-shadow: 0 6px 18px #3c256110; }
    .badges-heading { display: flex; align-items: center; gap: .55rem; margin-bottom: .6rem; color: #7b37ce; }
    .badges-heading h2 { margin: 0; color: #3d167b; font: 700 1.2rem var(--ek-font-display); }
    .demo-label { margin-left: auto; padding: .18rem .48rem; border-radius: 99px; background: #fff2ca; color: #795800; font-size: .66rem; font-weight: 850; }
    .badges-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: .5rem; }
    .badge { display: flex; align-items: center; gap: .5rem; min-width: 0; padding: .45rem .55rem; border: 1px solid #e6d9fc; border-radius: 15px; background: linear-gradient(115deg, #f5edff, #ece1ff); }
    .badge:nth-child(3n + 2) { border-color: #d3efce; background: linear-gradient(115deg, #f0ffeb, #e1f7dc); }
    .badge:nth-child(3n) { border-color: #fae9ad; background: linear-gradient(115deg, #fff9df, #fff0bd); }
    .badge__seal { position: relative; display: grid; place-items: center; flex: none; width: 40px; height: 40px; border: 2px solid #fff; border-radius: 50%; background: linear-gradient(145deg, #ffc93c, #ff9f1c); color: #fff; box-shadow: 0 3px 7px #713d2430; }
    .badge:nth-child(3n + 2) .badge__seal { background: linear-gradient(145deg, #65cfed, #378fe7); }
    .badge:nth-child(3n) .badge__seal { background: linear-gradient(145deg, #ffce44, #f49b20); }
    .badge strong { color: #33234c; font: 700 .76rem/1.15 var(--ek-font-display); }
    .badge--locked { filter: grayscale(.85); opacity: .63; }
    .badge__check, .badge__lock { position: absolute; right: -3px; bottom: -3px; display: grid; place-items: center; width: 17px; height: 17px; border: 2px solid #fff; border-radius: 50%; background: #37bd43; color: #fff; }
    .badge__lock { background: #8d879a; }
    .disclaimer { margin: .55rem 0 0; color: #80778d; font-size: .67rem; text-align: right; }
    @media (max-width: 520px) {
      .badges-card { padding: .8rem; }
      .badges-list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .38rem; }
      .badge { gap: .35rem; padding: .38rem; }
      .badge__seal { width: 34px; height: 34px; }
      .badge strong { font-size: .7rem; }
      .disclaimer { text-align: left; }
    }
  `,
})
export class ChildBadgesComponent {
  readonly badges = input.required<readonly ChildDashboardBadge[]>();
}
