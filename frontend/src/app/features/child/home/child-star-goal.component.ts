import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChildStarRewardGoal } from '../../../core/models/child-rewards.models';
import { ConfettiComponent } from '../play/ui/confetti.component';
import { OwlComponent } from '../../../shared/ui/brand/owl.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

@Component({
  selector: 'ek-child-star-goal',
  imports: [ConfettiComponent, IconComponent, OwlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (completed()) { <ek-play-confetti /> }
    <section class="goal-card" [class.goal-card--complete]="completed()" aria-labelledby="goal-title">
      <header class="goal-heading">
        <ek-icon name="star" [size]="34" />
        <h2 id="goal-title">Mon objectif étoiles</h2>
        <span class="demo-label">Exemple de démonstration</span>
      </header>

      @if (goal(); as currentGoal) {
        <div class="goal-content">
          <div class="goal-mascot" aria-hidden="true">
            <ek-owl [size]="126" [mood]="completed() ? 'cheer' : 'happy'" [sparkles]="completed()" />
          </div>
          <div class="goal-progress">
            <p class="goal-target">Objectif : <strong>{{ currentGoal.targetStars }} étoiles</strong></p>
            <p class="goal-count">
              <strong>{{ currentGoal.earnedStars }}</strong>
              <span>/ {{ currentGoal.targetStars }}</span>
              <ek-icon name="star" [size]="24" />
            </p>
            <div
              class="progress-track"
              role="progressbar"
              [attr.aria-valuenow]="percent()"
              aria-valuemin="0"
              aria-valuemax="100"
              [attr.aria-label]="percent() + ' % de l’objectif étoiles atteint'"
            >
              <span class="progress-fill" [style.width.%]="percent()"></span>
            </div>
            <p class="goal-encouragement" [class.goal-encouragement--complete]="completed()" aria-live="polite">
              @if (completed()) {
                Bravo {{ childName() }} ! Ta récompense est débloquée !
              } @else {
                Encore {{ remaining() }} étoiles pour débloquer ta récompense !
              }
            </p>
          </div>
          <aside class="promised-reward">
            <span class="gift" aria-hidden="true">🎁</span>
            <div>
              <span>Récompense promise :</span>
              <strong>{{ currentGoal.promisedReward }}</strong>
            </div>
            <ek-icon name="sparkles" [size]="25" />
          </aside>
        </div>
        <p class="goal-disclaimer">
          Exemple fictif : les étoiles et la récompense ne sont pas enregistrées.
        </p>
      } @else {
        <div class="no-goal">
          <ek-icon name="star" [size]="46" />
          <div>
            <h3>Aucun objectif pour le moment</h3>
            <p>Ton parent pourra bientôt te proposer un objectif et une récompense spéciale.</p>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .goal-card {
      position: relative;
      overflow: hidden;
      padding: 1.15rem 1.25rem 0.8rem;
      border: 1px solid #ded2fc;
      border-radius: 24px;
      background: linear-gradient(115deg, rgba(255,255,255,.96), rgba(249,245,255,.94));
      box-shadow: 0 7px 22px rgba(80, 46, 149, .09);
    }
    .goal-card--complete { border-color: #bdebb9; background: linear-gradient(115deg, #fff, #f3ffef); }
    .goal-heading { display: flex; align-items: center; gap: .65rem; padding-bottom: .65rem; border-bottom: 1px solid #e8e0f7; color: #ffbf00; }
    .goal-heading h2 { margin: 0; color: #4a168e; font: 750 clamp(1.35rem, 3vw, 1.8rem)/1.2 var(--ek-font-display); }
    .demo-label { margin-left: auto; padding: .25rem .55rem; border-radius: 99px; background: #fff2ca; color: #795800; font-size: .68rem; font-weight: 850; white-space: nowrap; }
    .goal-content { display: grid; grid-template-columns: minmax(100px, .75fr) minmax(250px, 2fr) minmax(205px, 1.15fr); align-items: center; gap: 1rem; padding: .85rem .3rem .1rem; }
    .goal-mascot { display: flex; justify-content: center; align-items: center; min-height: 132px; }
    .goal-progress { min-width: 0; }
    .goal-target { margin: 0 0 .25rem; color: #56506f; font-size: 1.17rem; font-weight: 800; }
    .goal-target strong { display: inline-block; padding: .16rem .75rem; border-radius: 99px; background: #efe3ff; color: #641bc1; font-family: var(--ek-font-display); }
    .goal-count { display: flex; align-items: baseline; gap: .3rem; margin: 0 0 .55rem; color: #635b7b; font-family: var(--ek-font-display); font-size: 1.8rem; font-weight: 750; }
    .goal-count strong { color: #258f39; font-size: clamp(2.2rem, 5vw, 3rem); line-height: 1; }
    .goal-count ek-icon { align-self: center; color: #ffbf00; }
    .progress-track { display: block; height: 18px; overflow: hidden; border-radius: 99px; background: #e7e2f3; box-shadow: inset 0 2px 4px #4e358018; }
    .progress-fill { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #63d84b, #30bd39); transition: width 450ms cubic-bezier(.2,.8,.2,1); }
    .goal-card--complete .progress-fill { background: linear-gradient(90deg, #ffcc32, #ff9a27); }
    .goal-encouragement { margin: .7rem 0 0; padding: .55rem .75rem; border-radius: 99px; background: #e4f7df; color: #3d2070; font-family: var(--ek-font-display); font-size: clamp(.85rem, 2vw, 1.1rem); font-weight: 700; text-align: center; }
    .goal-encouragement--complete { background: #fff0c4; color: #8a4c00; animation: reward-pop 550ms ease both; }
    .promised-reward { display: flex; align-items: center; gap: .65rem; min-height: 92px; padding: .85rem; border: 1px solid #ffebac; border-radius: 19px; background: linear-gradient(135deg, #fff9e6, #fff3cc); color: #382258; }
    .promised-reward .gift { font-size: 2.5rem; }
    .promised-reward div { display: grid; gap: .15rem; min-width: 0; }
    .promised-reward div span { font-size: .8rem; font-weight: 750; }
    .promised-reward strong { color: #6d27c2; font: 750 1.25rem/1.1 var(--ek-font-display); }
    .promised-reward ek-icon { flex: none; color: #ffbf00; }
    .goal-disclaimer { margin: .35rem 0 0; color: #80778d; font-size: .68rem; text-align: right; }
    .no-goal { display: flex; align-items: center; gap: 1rem; max-width: 680px; min-height: 150px; margin: auto; padding: 1rem; color: #8d68cf; }
    .no-goal h3 { margin: 0 0 .25rem; color: #4a168e; font: 700 1.2rem var(--ek-font-display); }
    .no-goal p { margin: 0; color: #716880; line-height: 1.45; }
    @keyframes reward-pop { 0% { transform: scale(.92); } 70% { transform: scale(1.04); } 100% { transform: scale(1); } }
    @media (max-width: 860px) {
      .goal-content { grid-template-columns: 90px minmax(0, 1fr); gap: .75rem; }
      .goal-mascot { grid-row: span 2; }
      .promised-reward { grid-column: 2; min-height: auto; }
    }
    @media (max-width: 560px) {
      .goal-card { padding: .85rem; }
      .goal-heading { flex-wrap: wrap; }
      .goal-heading h2 { font-size: 1.3rem; }
      .demo-label { margin-left: 0; }
      .goal-content { grid-template-columns: 1fr; gap: .5rem; padding: .65rem 0 0; }
      .goal-mascot { grid-row: auto; min-height: 78px; }
      .goal-mascot ek-owl { transform: scale(.68); }
      .goal-progress { text-align: center; }
      .goal-target { font-size: 1rem; }
      .goal-count { justify-content: center; }
      .promised-reward { grid-column: 1; justify-content: center; }
      .goal-disclaimer { text-align: center; }
      .no-goal { min-height: 130px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .progress-fill { transition: none; }
      .goal-encouragement--complete { animation: none; }
    }
  `,
})
export class ChildStarGoalComponent {
  readonly goal = input<ChildStarRewardGoal | null>(null);
  readonly childName = input('toi');

  protected readonly completed = computed(() => {
    const goal = this.goal();
    return !!goal && goal.targetStars > 0 && goal.earnedStars >= goal.targetStars;
  });
  protected readonly percent = computed(() => {
    const goal = this.goal();
    return goal && goal.targetStars > 0
      ? Math.min(100, Math.round((goal.earnedStars / goal.targetStars) * 100))
      : 0;
  });
  protected readonly remaining = computed(() => {
    const goal = this.goal();
    return goal ? Math.max(0, goal.targetStars - goal.earnedStars) : 0;
  });
}
