import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GamesGateway } from '../../../../core/gateways/games.gateway';
import { getCategory } from '../../../../core/models/categories';
import { GameDto } from '../../../../core/models/activites.models';
import { SpaceContext } from '../space-context';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { IconName } from '../../../../shared/ui/icon/icon.data';

@Component({
  selector: 'ek-category-games-page',
  imports: [RouterLink, IconComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="head"><a routerLink="../jeux">‹ Toutes les catégories</a><p class="eyebrow">{{ category()?.label }}</p><h1>{{ category()?.label ?? 'Activité' }}</h1><p>{{ category()?.description }}</p></section>
    @if (category()?.gameType === null) {
      <div class="notice"><strong>Mode démonstration</strong><p>Cette catégorie est visible, mais son moteur de jeu n’est pas encore relié. Les données affichées ne sont pas enregistrées.</p></div>
    } @else {
      <div class="tools"><span>{{ games().length }} jeu{{ games().length > 1 ? 'x' : '' }}</span><a class="ek-btn ek-btn--primary" [routerLink]="['nouveau']"><ek-icon name="plus" [size]="18"/> Créer un jeu</a></div>
      @if (loading()) { <p class="notice">Chargement des jeux…</p> }
      @if (error()) { <div class="notice"><strong>Jeux indisponibles</strong><p>{{ error() }}</p><p>Le serveur de jeux doit être lancé pour afficher les jeux de cette catégorie.</p></div> }
      @if (!loading() && !error() && !games().length) { <div class="empty"><h2>Pas encore de jeu</h2><p>Créez la première activité de {{ ctx.space()?.nomEnfant }}.</p><a class="ek-btn ek-btn--primary" [routerLink]="['nouveau']">Créer un jeu</a></div> }
      <div class="list">@for (game of games(); track game.id) { <article><span class="game-icon"><ek-icon [name]="categoryIcon()" [size]="22"/></span><div><strong>{{ game.title || 'Jeu sans titre' }}</strong><small>Créé le {{ game.createdAt | date:'d MMM y' }}</small></div><a [routerLink]="[game.id, 'modifier']">Modifier</a></article> }</div>
    }
  `,
  styles: `
    :host{display:block}.head{margin:1rem 0 1.5rem}.head>a{color:#75639a;text-decoration:none;font-weight:700}.eyebrow{margin:1.25rem 0 0;color:#8064be;font-size:.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}h1{margin:.3rem 0;color:#29233b;font-size:2rem}.head>p:last-child{color:#777181}.tools{display:flex;align-items:center;justify-content:space-between;margin:1.5rem 0;color:#756f80}.list{display:grid;gap:.75rem}.list article{display:flex;align-items:center;gap:1rem;background:white;padding:1rem;border-radius:1rem;box-shadow:0 5px 20px #34224b10}.game-icon{width:2.8rem;height:2.8rem;background:#f2eef9;color:#7655ad;border-radius:.8rem;display:grid;place-items:center}.list article div{flex:1}.list strong,.list small{display:block}.list small{color:#827c8c;margin-top:.25rem}.list a{color:#7258aa;font-weight:700;text-decoration:none}.notice,.empty{background:white;border-radius:1rem;padding:1.5rem;margin:1rem 0;color:#6f687a}.notice strong,.empty h2{color:#322b40}.empty{text-align:center;padding:2rem}
  `,
})
export class CategoryGamesPage {
  protected readonly ctx = inject(SpaceContext);
  private readonly route = inject(ActivatedRoute);
  private readonly gateway = inject(GamesGateway);
  private readonly routeId = signal(this.route.snapshot.paramMap.get('categoryId') ?? '');
  protected readonly category = computed(() => getCategory(this.routeId()));
  protected readonly games = signal<GameDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly categoryIcon = computed<IconName>(() => ({ maths:'calculator', association:'puzzle', ordonnancement:'list-ordered', dictee:'volume' }[this.routeId()] as IconName | undefined ?? 'gamepad'));

  constructor() {
    this.route.paramMap.subscribe((params) => {
      this.routeId.set(params.get('categoryId') ?? '');
      this.load();
    });
  }
  private load(): void {
    const spaceId = this.ctx.spaceId();
    const type = this.category()?.gameType;
    this.error.set(''); this.games.set([]);
    if (!spaceId || !type) { this.loading.set(false); return; }
    this.loading.set(true);
    this.gateway.listGames(spaceId, type, 'parent').subscribe({
      next: (games) => { this.games.set(games); this.loading.set(false); },
      error: (err: unknown) => { this.error.set(err instanceof Error ? err.message : 'Impossible de joindre le service de jeux.'); this.loading.set(false); },
    });
  }
}
