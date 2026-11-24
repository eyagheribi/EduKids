import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GamesGateway } from '../../../core/gateways/games.gateway';
import { GameDto } from '../../../core/models/activites.models';
import { getCategory } from '../../../core/models/categories';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { IconName } from '../../../shared/ui/icon/icon.data';
import { ChildContext } from '../child-context';

@Component({
  selector: 'ek-child-category-page', imports: [RouterLink, IconComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" routerLink="/enfant">‹ Mes activités</a>
    <header><span class="icon"><ek-icon [name]="icon()" [size]="30"/></span><p>À toi de jouer !</p><h1>{{ category()?.childLabel }}</h1><span>{{ category()?.childDescription }}</span></header>
    @if (category()?.gameType === null) { <div class="message"><strong>Bientôt disponible</strong><p>Cette activité est une maquette : aucun jeu n’est enregistré ici pour le moment.</p></div> }
    @if (loading()) { <p class="message">On cherche tes jeux…</p> }
    @if (error()) { <div class="message"><strong>Les jeux ne sont pas disponibles</strong><p>Demande à ton parent de vérifier que le service est lancé.</p><button (click)="load()">Réessayer</button></div> }
    <div class="games">@for (game of games(); track game.id) { <a class="game" [routerLink]="['/enfant/jouer', game.id]"><span>🎲</span><strong>{{ game.title || 'Mon jeu' }}</strong><small>Jouer maintenant <b>›</b></small></a> }</div>
    @if (!loading() && !error() && !games().length && category()?.gameType) { <div class="message">Il n’y a pas encore de jeu dans cette catégorie. Demande à ton parent d’en créer un !</div> }
  `,
  styles: `:host{display:block;max-width:900px;margin:auto}.back{display:inline-block;margin:.5rem 0;color:#755da4;font-weight:800;text-decoration:none}header{text-align:center;padding:1rem 0 1.5rem;color:#6c6578}header p{color:#8064be;font-weight:800;margin:.6rem 0 0}header h1{font-size:2.4rem;color:#332b42;margin:.25rem}.icon{display:grid;margin:auto;width:4rem;height:4rem;place-items:center;border-radius:1.3rem;background:#eee7fb;color:#8157b6}.games{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}.game{display:flex;flex-direction:column;gap:.7rem;padding:1.3rem;background:#fff;border-radius:1.4rem;text-decoration:none;color:#3b3448;box-shadow:0 8px 25px #30214512}.game>span{font-size:2rem}.game strong{font-size:1.15rem}.game small{color:#8064be}.game b{float:right}.message{margin:1rem auto;padding:1.3rem;border-radius:1rem;background:white;color:#706a7b}.message strong{color:#342c42}.message button{border:0;background:#7856b4;color:white;padding:.6rem 1rem;border-radius:2rem}`,
})
export class ChildCategoryPage {
  protected readonly ctx = inject(ChildContext);
  private readonly route = inject(ActivatedRoute);
  private readonly gateway = inject(GamesGateway);
  private readonly categoryId = signal(this.route.snapshot.paramMap.get('categoryId') ?? '');
  protected readonly category = computed(() => getCategory(this.categoryId()));
  protected readonly icon = computed<IconName>(() => ({ maths:'calculator', association:'puzzle', ordonnancement:'list-ordered', dictee:'volume' }[this.categoryId()] as IconName | undefined ?? 'gamepad'));
  protected readonly games = signal<GameDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  constructor() { this.route.paramMap.subscribe(p => { this.categoryId.set(p.get('categoryId') ?? ''); this.load(); }); }
  protected load(): void {
    const type = this.category()?.gameType; const spaceId = this.ctx.spaceId();
    this.error.set(false); this.games.set([]);
    if (!type || !spaceId) { this.loading.set(false); return; }
    this.loading.set(true);
    this.gateway.listGames(spaceId, type, 'child').subscribe({ next: data => { this.games.set(data); this.loading.set(false); }, error: () => { this.error.set(true); this.loading.set(false); } });
  }
}
