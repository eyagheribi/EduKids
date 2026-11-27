import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GamesGateway } from '../../../../core/gateways/games.gateway';
import { GameType, GameDto, CreateGameRequest, parseGameContent } from '../../../../core/models/activites.models';
import { getCategory } from '../../../../core/models/categories';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { SpaceContext } from '../space-context';

@Component({
  selector:'ek-game-editor-page', imports:[FormsModule,RouterLink,IconComponent], changeDetection:ChangeDetectionStrategy.OnPush,
  template:`
    <a class="back" [routerLink]="['/parent/enfants',ctx.spaceId(),'jeux',categoryId()]"><ek-icon name="arrow-left" [size]="16"/> Retour aux jeux</a>
    <header><p class="eyebrow">{{category()?.label}}</p><h1>{{gameId()?'Modifier le jeu':'Créer un jeu'}}</h1><p>Préparez une activité pour {{ctx.space()?.nomEnfant}}.</p></header>
    @if (error()) { <div class="alert">{{error()}}</div> }
    <form (ngSubmit)="save()"><label>Titre <span>(facultatif)</span><input name="title" [(ngModel)]="title" maxlength="80" placeholder="Ex. Les additions rigolotes"></label>
      @if(type()==='MATH'){<label>Calcul à résoudre<input name="expression" [(ngModel)]="expression" required placeholder="12 + 7"></label><p class="hint">Utilisez +, −, ×, ÷ et des parenthèses.</p>}
      @if(type()==='SENTENCE_ORDERING' || type()==='DICTATION'){<label>{{type()==='DICTATION'?'Phrase à dicter':'Phrase à remettre en ordre'}}<textarea name="sentence" [(ngModel)]="sentence" required minlength="3" rows="3" placeholder="Le petit chat joue dans le jardin."></textarea></label><p class="hint">{{type()==='DICTATION'?'La phrase sera lue à voix haute.':'Saisissez au moins deux mots.'}}</p>}
      @if(type()==='MATCHING'){<fieldset><legend>Paires à associer</legend>@for(pair of pairs;track $index){<div class="pair"><input [name]="'left'+$index" [(ngModel)]="pair.left" required [attr.aria-label]="'Élément gauche '+($index+1)" placeholder="Ex. Chat"><span>↔</span><input [name]="'right'+$index" [(ngModel)]="pair.right" required [attr.aria-label]="'Élément droit '+($index+1)" placeholder="Ex. Chaton"><button type="button" (click)="removePair($index)" [disabled]="pairs.length<=2" aria-label="Retirer la paire">×</button></div>}<button type="button" class="add" (click)="addPair()">+ Ajouter une paire</button></fieldset>}
      <div class="actions"><a class="cancel" [routerLink]="['/parent/enfants',ctx.spaceId(),'jeux',categoryId()]">Annuler</a><button class="save" [disabled]="saving()">{{saving()?'Enregistrement…':(gameId()?'Enregistrer':'Créer le jeu')}}</button></div>
    </form>
  `,
  styles:`:host{display:block;max-width:760px;margin:auto}.back{display:inline-flex;gap:.4rem;align-items:center;color:#70569d;text-decoration:none;font-weight:700;margin:.5rem 0 1rem}header .eyebrow{color:#805fb1;font-weight:800;text-transform:uppercase;font-size:.78rem;letter-spacing:.08em;margin:0}h1{margin:.25rem 0;color:#30283c;font-size:2rem}header>p:last-child,.hint{color:#777181}form{background:white;border-radius:1.25rem;padding:clamp(1rem,4vw,2rem);box-shadow:0 8px 28px #30214512}label{display:block;margin:1.1rem 0;color:#433b51;font-weight:750}label span{font-weight:400;color:#837d8b;font-size:.85rem}input,textarea{display:block;width:100%;box-sizing:border-box;margin-top:.45rem;border:1px solid #ded9e7;border-radius:.7rem;padding:.8rem;font:inherit;color:#342d40;background:#fff}input:focus,textarea:focus{outline:3px solid #d9c8f2;border-color:#8a67bd}.hint{font-size:.88rem}fieldset{border:0;padding:0;margin:1rem 0}legend{font-weight:800;color:#433b51;margin-bottom:.5rem}.pair{display:grid;grid-template-columns:1fr auto 1fr auto;gap:.55rem;align-items:center;margin:.6rem 0}.pair input{margin:0}.pair button{border:0;background:#f8e8e9;color:#a3484c;border-radius:50%;width:2rem;height:2rem;font-size:1.2rem}.add{background:transparent;border:1px dashed #9d87bb;color:#7657a3;border-radius:.7rem;padding:.6rem .9rem;font-weight:700}.actions{display:flex;justify-content:flex-end;align-items:center;gap:1rem;margin-top:2rem}.cancel{color:#746d7d;text-decoration:none}.save{border:0;background:#7655ad;color:white;border-radius:2rem;padding:.8rem 1.4rem;font:inherit;font-weight:800;cursor:pointer}.save:disabled{opacity:.6}.alert{padding:.8rem 1rem;border-radius:.75rem;background:#fff0ee;color:#a33b37;margin:1rem 0}@media(max-width:520px){.pair{grid-template-columns:1fr auto 1fr}.pair button{grid-column:3;justify-self:end}}`,
})
export class GameEditorPage {
  protected readonly ctx=inject(SpaceContext); private readonly route=inject(ActivatedRoute);private readonly router=inject(Router);private readonly gateway=inject(GamesGateway);
  protected readonly categoryId=signal(this.route.snapshot.paramMap.get('categoryId')??'');protected readonly gameId=signal(this.route.snapshot.paramMap.get('gameId')??'');
  protected readonly category=computed(()=>getCategory(this.categoryId()));protected readonly type=computed<GameType>(()=>this.category()?.gameType??'MATH');
  protected title='';protected expression='';protected sentence='';protected pairs=[{left:'',right:''},{left:'',right:''}];protected readonly error=signal('');protected readonly saving=signal(false);
  constructor(){if(this.gameId())this.gateway.getGame(this.ctx.spaceId(),this.gameId(),'parent').subscribe({next:g=>this.fill(g),error:()=>this.error.set('Le jeu ne peut pas être chargé.')});}
  protected addPair():void{this.pairs=[...this.pairs,{left:'',right:''}]}protected removePair(i:number):void{if(this.pairs.length>2)this.pairs=this.pairs.filter((_,n)=>n!==i)}
  private fill(game:GameDto):void{this.title=game.title??'';const content=parseGameContent(game.type,game.content);if(content?.type==='MATH')this.expression=content.expression;if(content?.type==='MATCHING')this.pairs=content.pairs.map(p=>({left:p.left,right:p.right}));if(content?.type==='SENTENCE_ORDERING'||content?.type==='DICTATION')this.sentence=content.sentence;}
  protected save():void{if(this.saving())return;this.error.set('');let content:CreateGameRequest['content'];
    if(this.type()==='MATH'){if(!this.expression.trim()){this.error.set('Saisissez un calcul.');return}content={expression:this.expression.trim()}}
    else if(this.type()==='MATCHING'){const rows=this.pairs.map(p=>({left:p.left.trim(),right:p.right.trim()}));if(rows.some(p=>!p.left||!p.right)||rows.length<2){this.error.set('Complétez au moins deux paires.');return}content={pairs:rows}}
    else{if(this.sentence.trim().split(/\s+/).length<2){this.error.set('Saisissez une phrase d’au moins deux mots.');return}content={sentence:this.sentence.trim()}}
    const request={type:this.type(),title:this.title.trim()||null,content};this.saving.set(true);
    const call=this.gameId()?this.gateway.updateGame(this.ctx.spaceId(),this.gameId(),request):this.gateway.createGame(this.ctx.spaceId(),request);
    call.subscribe({next:()=>{this.saving.set(false);void this.router.navigate(['/parent/enfants',this.ctx.spaceId(),'jeux',this.categoryId()])},error:(e:unknown)=>{this.saving.set(false);this.error.set(e instanceof Error?e.message:'Enregistrement impossible. Vérifiez le service de jeux.')}});
  }
}
