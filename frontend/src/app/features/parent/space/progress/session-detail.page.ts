import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProgressGateway } from '../../../../core/gateways/progress.gateway';
import { FINAL_STATUS_LABELS, SessionDetailDto } from '../../../../core/models/suivi.models';
import { SpaceContext } from '../space-context';

@Component({
  selector: 'ek-session-detail-page',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" [routerLink]="['/parent/enfants', ctx.spaceId(), 'progres']">‹ Retour aux résultats</a>
    @if (loading()) { <p class="panel">Chargement de la session…</p> }
    @if (error()) { <div class="panel"><h1>Détail indisponible</h1><p>{{ error() }}</p><p>Cette vue dépend des données transmises au service de suivi.</p></div> }
    @if (detail(); as d) {
      <header><p>SESSION DE {{ ctx.space()?.nomEnfant }}</p><h1>{{ d.gameTitle || 'Jeu sans titre' }}</h1><span class="status" [class]="'status ' + d.finalStatus">{{ statusLabel(d.finalStatus) }}</span></header>
      <div class="stats"><article><small>Résultat</small><strong>{{ d.finalScore }} / {{ d.finalMaxScore ?? '—' }}</strong></article><article><small>Essais utilisés</small><strong>{{ d.attemptsUsed }} / {{ d.maxAttempts }}</strong></article><article><small>Commencée</small><strong>{{ d.startedAt | date:'d MMM y, HH:mm' }}</strong></article></div>
      <section class="panel"><h2>Réponses</h2>@if (d.attempts.length) { <ol>@for (attempt of d.attempts; track attempt.attemptId) { <li><div><strong>Essai {{ attempt.attemptNumber }}</strong><span>{{ attempt.submittedAt | date:'HH:mm' }}</span></div><p>{{ attempt.correct ? 'Réponse correcte' : 'Réponse à reprendre' }} · {{ attempt.score }} / {{ attempt.maxScore }} points</p></li> }</ol> } @else { <p>Aucune réponse enregistrée.</p> }</section>
      <p class="note">Les réponses détaillées sont conservées au format transmis par le jeu. Le service de suivi ne fournit pas encore une reformulation lisible pour chaque moteur.</p>
    }
  `,
  styles: `:host{display:block;max-width:950px;margin:auto}.back{display:inline-block;margin:1rem 0;color:#7255a4;text-decoration:none;font-weight:800}header{padding:.5rem 0 1rem}header>p{color:#7b5cad;font-size:.76rem;font-weight:850;letter-spacing:.1em}h1{margin:.25rem 0;color:#332b42;font-size:2.2rem}.status{display:inline-block;padding:.35rem .7rem;border-radius:1rem;background:#e8f6e9;color:#327a42;font-size:.8rem;font-weight:800}.status.FAILED{background:#fff0ec;color:#a84434}.status.UNFINISHED{background:#fff6db;color:#8a6718}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.8rem;margin:1rem 0}.stats article,.panel{background:white;border-radius:1rem;padding:1.2rem;box-shadow:0 7px 24px #3021450e}.stats small,.stats strong{display:block}.stats small{color:#80798a}.stats strong{margin-top:.35rem;color:#3a3248;font-size:1.1rem}.panel h2{color:#3c344a;margin-top:0}.panel ol{list-style:none;padding:0;margin:0}.panel li{padding:.9rem 0;border-top:1px solid #eeeaf3}.panel li div{display:flex;justify-content:space-between;color:#3c344a}.panel li span,.panel li p,.note{color:#7a7385}.note{font-size:.85rem;max-width:700px;margin-top:1rem}`,
})
export class SessionDetailPage {
  protected readonly ctx = inject(SpaceContext);
  private readonly route = inject(ActivatedRoute);
  private readonly gateway = inject(ProgressGateway);
  protected readonly detail = signal<SessionDetailDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  constructor() {
    const id = this.route.snapshot.paramMap.get('sessionId') ?? '';
    this.gateway.sessionDetail(this.ctx.spaceId(), id).subscribe({
      next: (data) => { this.detail.set(data); this.loading.set(false); },
      error: () => { this.error.set('Les résultats ne sont pas disponibles dans cette intégration.'); this.loading.set(false); },
    });
  }

  protected statusLabel(status: SessionDetailDto['finalStatus']): string { return FINAL_STATUS_LABELS[status]; }
}
