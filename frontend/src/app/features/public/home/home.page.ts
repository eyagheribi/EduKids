import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoComponent } from '../../../shared/ui/brand/logo.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { IllustrationComponent } from '../../../shared/ui/illustration/illustration.component';

@Component({
  selector: 'ek-home-page',
  imports: [RouterLink, LogoComponent, IconComponent, IllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="welcome">
      <header class="topbar"><a routerLink="/" aria-label="EduKids, accueil"><ek-logo size="lg" /></a><a class="help" routerLink="/aide"><ek-icon name="help" /> Aide</a></header>
      <section class="intro"><span class="eyebrow">Apprendre en s’amusant</span><h1>Bienvenue sur EduKids <span>✦</span></h1><p>Une plateforme pour créer des jeux éducatifs personnalisés<br>et accompagner les apprentissages de votre enfant.</p></section>
      <section class="choices" aria-label="Choisissez votre espace">
        <article class="choice parent"><div class="art"><span class="orb">✦</span><ek-illustration name="parent-child-laptop" width="520" [decorative]="false" /></div><div class="choice-body"><h2><ek-icon name="users" /> Je suis un parent</h2><p>Créez un ou plusieurs espaces enfants, ajoutez des jeux et suivez leurs progrès.</p><a class="button purple" routerLink="/parent/connexion">Se connecter <span>→</span></a><a class="sub-link" routerLink="/parent/inscription">Créer un compte parent</a></div></article>
        <article class="choice child"><div class="art"><span class="orb">★</span><ek-illustration name="child-headphones" width="250" [decorative]="false" /></div><div class="choice-body"><h2><ek-icon name="gamepad" /> Je suis un enfant</h2><p>Accède à ton espace avec le code fourni par ton parent et joue à tes jeux !</p><a class="button green" routerLink="/enfant/connexion">Entrer un code <span>→</span></a></div></article>
      </section>
      <footer>Un petit pas chaque jour, de grandes réussites ! <span>💜</span></footer>
    </main>`,
  styles: [`
    :host{display:block;min-height:100vh;background:radial-gradient(ellipse at 50% 30%,#fff 0,#fbf9ff 60%,#f3eaff 100%);color:var(--ek-ink)}
    .welcome{max-width:1240px;margin:auto;padding:22px 36px 28px}.topbar{display:flex;align-items:center;justify-content:space-between}.topbar a{text-decoration:none}.help{display:flex;align-items:center;gap:9px;color:#422275;font-weight:800}.intro{text-align:center;padding:36px 0 28px}.eyebrow{display:inline-block;padding:6px 15px;border-radius:99px;background:#f0e8ff;color:#7345c9;font-weight:800;font-size:.85rem}.intro h1{font-size:clamp(2.3rem,5vw,3.7rem);margin:13px 0 8px;letter-spacing:-.03em}.intro h1 span{color:#55c06a}.intro p{font-size:1.2rem;color:#635b7e;font-weight:700}.choices{display:grid;grid-template-columns:1fr 1fr;gap:28px;max-width:1040px;margin:10px auto}.choice{border:2px solid #eee4ff;border-radius:30px;overflow:hidden;background:#fff;box-shadow:0 18px 45px #4a238716}.choice.child{border-color:#e2f4e4}.art{height:265px;position:relative;overflow:hidden;display:flex;justify-content:center;align-items:center;background:radial-gradient(ellipse,#e9dafd 0 35%,#f6f0ff 36% 68%,transparent 69%)}.child .art{background:radial-gradient(ellipse,#d9f1d8 0 35%,#effaef 36% 68%,transparent 69%)}.people{position:relative;z-index:1;font-size:8rem;line-height:1;filter:drop-shadow(0 10px 9px #57399022)}.people .kid{font-size:5rem;margin-left:-36px}.people.solo{font-size:9rem}.laptop{position:absolute;bottom:32px;left:42%;background:#7043c5;color:white;border-radius:14px;padding:10px 24px;box-shadow:0 8px 0 #532c9e;font-size:2rem}.green-laptop{background:#359847;box-shadow:0 8px 0 #217533}.orb{position:absolute;right:23%;top:20px;color:#ffc93c;font-size:2.3rem}.choice-body{text-align:center;padding:20px 30px 27px}.choice h2{display:flex;align-items:center;justify-content:center;gap:10px;font-size:1.65rem}.choice h2 ek-icon{color:#7546c8}.child h2 ek-icon{color:#32a348}.choice p{min-height:55px;margin:9px auto 17px;max-width:420px;color:#625a7a;font-size:1.03rem;font-weight:650}.button{display:flex;align-items:center;justify-content:center;gap:30px;max-width:290px;margin:auto;padding:13px 23px;border-radius:99px;color:white;text-decoration:none;font-family:var(--ek-font-display);font-size:1.2rem;font-weight:700;box-shadow:0 4px 0 #0002;transition:transform .18s}.button:hover{color:white;transform:translateY(-2px)}.purple{background:linear-gradient(110deg,#9a65df,#7136c1)}.green{background:linear-gradient(110deg,#4fba61,#258d3d)}.button span{font-size:1.4rem}.sub-link{display:inline-block;margin-top:11px;font-size:.9rem}footer{text-align:center;color:#77708f;font-weight:700;padding:14px}@media(max-width:760px){.welcome{padding:16px}.intro{padding:25px 0}.intro p br{display:none}.choices{grid-template-columns:1fr;gap:18px}.art{height:210px}.choice-body{padding:18px}.choice p{min-height:auto}}
  `],
})
export class HomePage {}
