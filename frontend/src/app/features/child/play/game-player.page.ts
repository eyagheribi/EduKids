import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GamesGateway } from '../../../core/gateways/games.gateway';
import { GameAnswer, Playable, SessionDto, toPlayable } from '../../../core/models/activites.models';
import { uuid } from '../../../shared/utils/ids';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ChildContext } from '../child-context';
import { outcomeOfAttempt, PlayScreen } from './play-model';

@Component({selector:'ek-game-player-page',imports:[FormsModule,RouterLink,IconComponent],changeDetection:ChangeDetectionStrategy.OnPush,
template:`
  <a class="back" routerLink="/enfant">‹ Mes activités</a>
  @if(loading()){<div class="panel"><h1>Préparation du jeu…</h1></div>}
  @if(error()){<div class="panel"><h1>Oups !</h1><p>{{error()}}</p><a routerLink="/enfant">Retour aux activités</a></div>}
  @if(playable();as game){@if(screen()==='playing'){
    <main class="panel"><p class="eyebrow">À TOI DE JOUER</p><h1>{{prompt()}}</h1>
      @if(game.type==='MATH'){<p class="expression">{{game.expression}} = ?</p><label class="answer">Ta réponse<input type="number" [(ngModel)]="mathAnswer" name="mathAnswer" inputmode="decimal" autofocus></label>}
      @if(game.type==='DICTATION'){<button type="button" class="speak" (click)="speak(game.sentence)"><ek-icon name="volume" [size]="18"/> Écouter la phrase</button><label class="answer">Écris ce que tu entends<textarea [(ngModel)]="textAnswer" name="dictation" rows="3"></textarea></label>}
      @if(game.type==='SENTENCE_ORDERING'){<p class="hint">Remets les mots dans l’ordre en les touchant.</p><div class="tokens">@for(token of orderedTokens();track token.id){<button type="button" (click)="moveToken(token.id)">{{token.label}}</button>}</div>}
      @if(game.type==='MATCHING'){<p class="hint">Choisis le partenaire de chaque mot.</p>@for(item of game.left;track item.id){<label class="match">{{item.label}}<select [(ngModel)]="matches[item.id]" [name]="item.id"><option value="">Choisir…</option>@for(right of game.right;track right.id){<option [value]="right.id">{{right.label}}</option>}</select></label>}}
      @if(feedback()){<p class="feedback">{{feedback()}}</p>}<button class="submit" [disabled]="submitting()" (click)="submit(game)">{{submitting()?'Vérification…':'Vérifier ma réponse'}}</button>
    </main>
  }@else if(screen()==='success'||screen()==='failed'||screen()==='unfinished'){
    <main class="panel end"><span class="emoji">{{screen()==='success'?'⭐':'💪'}}</span><h1>{{screen()==='success'?'Bravo !':'Bien joué !'}}</h1><p>{{screen()==='success'?'Tu as réussi ce jeu.':'Tu as fait de ton mieux. Tu pourras réessayer plus tard.'}}</p>@if(correction()){<div class="correction">{{correction()}}</div>}<a class="submit" routerLink="/enfant">Retour aux activités</a></main>
  }}
`,styles:`:host{display:block;max-width:760px;margin:auto}.back{display:inline-block;color:#755da4;font-weight:800;text-decoration:none;margin:.5rem 0}.panel{margin:1rem auto;background:#fff;border-radius:1.6rem;padding:clamp(1.3rem,5vw,3rem);text-align:center;box-shadow:0 12px 35px #30214514}.eyebrow{font-weight:800;color:#8262b5;letter-spacing:.1em}.panel h1{color:#342b43;font-size:clamp(1.8rem,5vw,2.7rem)}.expression{font-size:clamp(2rem,8vw,4rem);font-weight:900;color:#6f50a4;margin:2rem}.answer{display:block;text-align:left;max-width:460px;margin:1.3rem auto;color:#514960;font-weight:800}.answer input,.answer textarea,.match select{display:block;width:100%;box-sizing:border-box;margin-top:.5rem;padding:.85rem;border:2px solid #e1d9ed;border-radius:.8rem;font:inherit;font-size:1.2rem}.answer input:focus,.answer textarea:focus{outline:3px solid #e7daf7}.submit,.speak{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border:0;border-radius:2rem;background:#7655ad;color:white;text-decoration:none;padding:.85rem 1.5rem;font:inherit;font-weight:850;cursor:pointer}.submit:disabled{opacity:.65}.speak{background:#f1eafd;color:#6f4da3}.hint{color:#777181}.match{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:.7rem auto;max-width:500px;text-align:left;font-weight:800}.match select{max-width:250px;font-size:1rem}.tokens{display:flex;justify-content:center;flex-wrap:wrap;gap:.6rem}.tokens button{border:0;background:#f0eafa;color:#5f4788;border-radius:.7rem;padding:.75rem;font:inherit;font-weight:800}.feedback{color:#805c9e;font-weight:700}.end .emoji{font-size:4rem}.correction{background:#f6f1fc;padding:1rem;border-radius:1rem;margin:1rem}.end .submit{margin-top:1rem}`})
export class GamePlayerPage{
  private readonly ctx=inject(ChildContext);private readonly route=inject(ActivatedRoute);private readonly gateway=inject(GamesGateway);
  private readonly gameId=this.route.snapshot.paramMap.get('gameId')??'';private readonly session=signal<SessionDto|null>(null);
  protected readonly loading=signal(true);protected readonly error=signal('');protected readonly submitting=signal(false);protected readonly feedback=signal('');protected textAnswer='';
  protected mathAnswer='';protected matches:Record<string,string>={};private readonly orderedIds=signal<string[]>([]);private readonly currentScreen=signal<PlayScreen['kind']>('loading');
  protected readonly playable=computed(()=>toPlayable(this.session()?.game));protected readonly orderedTokens=computed(()=>{const p=this.playable();if(p?.type!=='SENTENCE_ORDERING')return[];const byId=new Map(p.tokens.map(x=>[x.id,x]));return this.orderedIds().map(id=>byId.get(id)).filter((x):x is NonNullable<typeof x>=>!!x)});
  protected readonly screen=this.currentScreen.asReadonly();protected readonly correction=signal('');
  protected readonly prompt=computed(()=>this.playable()?.type==='SENTENCE_ORDERING'?'Remets la phrase dans l’ordre':this.playable()?.type==='MATCHING'?'Relie les bonnes paires':'Prêt ?');
  constructor(){if(!this.gameId){this.error.set('Ce jeu est introuvable.');this.loading.set(false);return}this.gateway.startSession(this.ctx.spaceId(),this.gameId).subscribe({next:s=>{this.session.set(s);const p=toPlayable(s.game);if(p?.type==='SENTENCE_ORDERING')this.orderedIds.set([...p.tokens].sort(()=>Math.random()-.5).map(t=>t.id));this.currentScreen.set('playing');this.loading.set(false)},error:e=>{this.error.set(e instanceof Error?e.message:'Ce jeu ne peut pas démarrer pour le moment.');this.loading.set(false)}})}
  protected moveToken(id:string):void{this.orderedIds.update(ids=>{const i=ids.indexOf(id);return i<0?ids:[...ids.slice(i+1),...ids.slice(0,i+1)]})}
  protected speak(sentence:string):void{if('speechSynthesis'in window){window.speechSynthesis.cancel();window.speechSynthesis.speak(new SpeechSynthesisUtterance(sentence))}}
  protected submit(game:Playable):void{const s=this.session();if(!s||this.submitting())return;let answer:GameAnswer;
    if(game.type==='MATH'){const value=Number(this.mathAnswer);if(!this.mathAnswer.trim()||!Number.isFinite(value)){this.feedback.set('Écris un nombre pour continuer.');return}answer={value}}
    else if(game.type==='DICTATION')answer={text:this.textAnswer.trim()};
    else if(game.type==='SENTENCE_ORDERING')answer={tokens:this.orderedIds()};
    else answer={matches:{...this.matches}};
    this.submitting.set(true);this.feedback.set('');this.gateway.submitAttempt(this.ctx.spaceId(),s.id,{idempotencyKey:uuid(),answer}).subscribe({next:a=>{this.submitting.set(false);const outcome=outcomeOfAttempt(game.type,a);if(outcome.kind==='retry')this.feedback.set(`Essaie encore. Il te reste ${outcome.feedback.attemptsRemaining} essai(s).`);else{this.currentScreen.set(outcome.screen.kind);if(outcome.screen.kind==='failed'&&outcome.screen.correction)this.correction.set(JSON.stringify(outcome.screen.correction))}},error:e=>{this.submitting.set(false);this.feedback.set(e instanceof Error?e.message:'Réponse non envoyée. Réessaie.')}})
  }
}
