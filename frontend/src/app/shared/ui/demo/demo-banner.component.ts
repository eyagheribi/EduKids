import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

export type DemoSubject = 'games' | 'progress' | 'dictation' | 'notifications' | 'sentence-ordering';

const COPY: Record<DemoSubject, { title: string; text: string }> = {
  games: {
    title: 'Jeux en mode démonstration',
    text:
      'Activites.Api n’accepte pas encore l’authentification EduKids : les jeux, sessions et tentatives sont simulés et enregistrés uniquement dans ce navigateur, selon les règles réelles du service.',
  },
  progress: {
    title: 'Suivi en mode démonstration',
    text:
      'Suivi.Api n’accepte pas encore l’authentification EduKids : ces résultats proviennent des parties jouées en démonstration dans ce navigateur (aucune donnée réelle).',
  },
  dictation: {
    title: 'Démonstration statique',
    text:
      'Aucun moteur de dictée n’existe dans Activites.Api : cet écran est un aperçu non connecté, aucune donnée n’est enregistrée.',
  },
  notifications: {
    title: 'Notifications indisponibles',
    text: 'Notifications.Api n’expose encore aucune fonctionnalité : aucune notification ne peut être affichée.',
  },
  'sentence-ordering': {
    title: 'Catégorie non activable',
    text:
      'Espaces.Api n’accepte que Maths, Association et Dictee : l’ordonnancement de mots (moteur SENTENCE_ORDERING) n’est proposé qu’en démonstration.',
  },
};

/**
 * Clearly identifies non-connected features.
 *   <ek-demo-banner subject="games" />            (parent, full banner)
 *   <ek-demo-banner subject="games" variant="badge" />   (compact chip)
 */
@Component({
  selector: 'ek-demo-banner',
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'badge') {
      <span class="ek-chip ek-chip--yellow" [attr.title]="copy().text">
        <ek-icon name="flask" [size]="14" /> Démo
      </span>
    } @else {
      <div class="ek-alert ek-alert--warning" role="note">
        <ek-icon name="flask" [size]="22" />
        <div class="body">
          <strong>{{ copy().title }}</strong>
          <p>{{ copy().text }}</p>
        </div>
        @if (showLink()) {
          <a class="more" routerLink="/parent/parametres" fragment="integrations">Pourquoi ?</a>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    :host([variant='badge']) {
      display: inline-flex;
    }
    .body {
      flex: 1;
      display: grid;
      gap: 0.15rem;
    }
    .more {
      align-self: center;
      white-space: nowrap;
      color: #6b4a00;
    }
  `,
  host: { '[attr.variant]': 'variant()' },
})
export class DemoBannerComponent {
  readonly subject = input.required<DemoSubject>();
  readonly variant = input<'banner' | 'badge'>('banner');
  /** Link to the integration status page (parent area only). */
  readonly showLink = input(true);

  protected copy() {
    return COPY[this.subject()];
  }
}
