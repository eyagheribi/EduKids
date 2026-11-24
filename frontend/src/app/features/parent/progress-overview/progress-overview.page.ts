import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

@Component({ selector: 'ek-progress-overview-page', imports: [RouterLink, IconComponent], changeDetection: ChangeDetectionStrategy.OnPush, template: `
  <header><p>ESPACE PARENT</p><h1>Suivi des progrès</h1><span>Les résultats sont présentés dans l’espace de chaque enfant.</span></header>
  <section><div class="icon"><ek-icon name="chart-line" [size]="32"/></div><h2>Consultez les résultats d’un enfant</h2><p>Ouvrez son espace puis l’onglet « Résultats et progrès » pour retrouver les sessions, les réussites et les activités à reprendre.</p><a routerLink="/parent/enfants" class="action">Choisir un enfant <span>→</span></a><small>Les tableaux affichent un indicateur de démonstration quand les données réelles ne sont pas activées.</small></section>
`, styles: `:host{display:block;max-width:950px;margin:auto}header{padding:2rem 0 1.5rem}header>p{color:#795bac;font-size:.8rem;letter-spacing:.1em;font-weight:800}h1{margin:.3rem 0;color:#342b43;font-size:2.4rem}header span,section p,section small{color:#766f80}section{max-width:650px;margin:2rem auto;background:white;text-align:center;padding:2.5rem;border-radius:1.4rem;box-shadow:0 8px 28px #30214510}.icon{margin:auto;width:4rem;height:4rem;border-radius:1.2rem;display:grid;place-items:center;background:#f1eafd;color:#805cb4}section h2{color:#3b334a}.action{display:inline-flex;gap:1rem;padding:.8rem 1.2rem;border-radius:2rem;background:#7655ad;color:white;font-weight:800;text-decoration:none;margin:1rem 0}section small{display:block;max-width:450px;margin:auto}` })
export class ProgressOverviewPage {}
