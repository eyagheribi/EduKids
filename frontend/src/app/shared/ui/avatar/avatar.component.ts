import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { resolveAvatar } from './avatars';

let avatarCounter = 0;

/**
 * Child avatar (vector). `avatar` is the key stored in Espaces.Api; when empty or unknown a stable
 * default is derived from `seed` (use the space id).
 *   <ek-avatar [avatar]="space.avatar" [seed]="space.id" [size]="56" />
 */
@Component({
  selector: 'ek-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let a = def();
    <svg
      viewBox="0 0 100 100"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      [attr.aria-hidden]="label() ? null : 'true'"
    >
      <defs>
        <clipPath [attr.id]="clipId"><circle cx="50" cy="50" r="50" /></clipPath>
      </defs>
      <g [attr.clip-path]="'url(#' + clipId + ')'">
        <rect width="100" height="100" [attr.fill]="a.bg" />
        <circle cx="50" cy="50" r="38" fill="#fff" opacity=".35" />

        <!-- back hair -->
        @switch (a.hairStyle) {
          @case ('bob') {
            <path d="M22 52 Q19 18 50 17 Q81 18 78 52 L80 74 Q70 79 66 67 L34 67 Q30 79 20 74 Z" [attr.fill]="a.hair" />
          }
          @case ('pigtails') {
            <circle cx="20" cy="50" r="11" [attr.fill]="a.hair" />
            <circle cx="80" cy="50" r="11" [attr.fill]="a.hair" />
            <circle cx="27" cy="42" r="3.2" [attr.fill]="a.accent" />
            <circle cx="73" cy="42" r="3.2" [attr.fill]="a.accent" />
          }
          @case ('bun') {
            <circle cx="50" cy="17" r="11" [attr.fill]="a.hair" />
          }
        }

        <!-- body -->
        <path d="M16 104 Q18 76 50 74 Q82 76 84 104 Z" [attr.fill]="a.shirt" />
        <path d="M40 75 Q50 83 60 75" [attr.stroke]="a.skin" stroke-width="7" fill="none" stroke-linecap="round" />

        <!-- head -->
        <circle cx="26.5" cy="52" r="5.5" [attr.fill]="a.skin" />
        <circle cx="73.5" cy="52" r="5.5" [attr.fill]="a.skin" />
        <circle cx="50" cy="49" r="24.5" [attr.fill]="a.skin" />

        <!-- front hair -->
        @switch (a.hairStyle) {
          @case ('curly') {
            <g [attr.fill]="a.hair">
              <circle cx="30" cy="38" r="9" />
              <circle cx="37" cy="29" r="10" />
              <circle cx="50" cy="25" r="11" />
              <circle cx="63" cy="29" r="10" />
              <circle cx="70" cy="38" r="9" />
              <circle cx="27" cy="47" r="6" />
              <circle cx="73" cy="47" r="6" />
              <circle cx="43" cy="34" r="7.5" />
              <circle cx="57" cy="34" r="7.5" />
            </g>
          }
          @case ('short') {
            <path d="M25 50 Q22 22 50 21 Q78 22 75 50 Q72 38 62 34 Q52 39 40 35 Q29 39 25 50 Z" [attr.fill]="a.hair" />
          }
          @case ('bob') {
            <path d="M26 46 Q28 23 50 22 Q72 23 74 46 Q65 33 50 35 Q35 33 26 46 Z" [attr.fill]="a.hair" />
          }
          @case ('pigtails') {
            <path d="M26 47 Q27 23 50 22 Q73 23 74 47 Q66 35 52 37 Q40 31 26 47 Z" [attr.fill]="a.hair" />
          }
          @case ('bun') {
            <path d="M26 47 Q27 23 50 22 Q73 23 74 47 Q60 36 50 33 Q40 36 26 47 Z" [attr.fill]="a.hair" />
          }
          @case ('spiky') {
            <path d="M25 49 L24 32 L33 36 L35 22 L43 31 L50 18 L57 31 L65 22 L67 36 L76 32 L75 49 Q66 37 50 37 Q34 37 25 49 Z" [attr.fill]="a.hair" />
          }
        }

        <!-- face -->
        <ellipse cx="41" cy="51" rx="3.3" ry="4.1" fill="#2a1a33" />
        <ellipse cx="59" cy="51" rx="3.3" ry="4.1" fill="#2a1a33" />
        <circle cx="42.2" cy="49.4" r="1.2" fill="#fff" />
        <circle cx="60.2" cy="49.4" r="1.2" fill="#fff" />
        <ellipse cx="35" cy="59" rx="4.6" ry="2.7" fill="#f27f8f" opacity=".45" />
        <ellipse cx="65" cy="59" rx="4.6" ry="2.7" fill="#f27f8f" opacity=".45" />
        <path d="M43 60 Q50 68 57 60 Q50 63.5 43 60 Z" fill="#8c2f3c" stroke="#8c2f3c" stroke-width="1.6" stroke-linejoin="round" />

        <!-- accessories -->
        @switch (a.accessory) {
          @case ('bow') {
            <g [attr.fill]="a.accent">
              <path d="M28 25 L37 30 L28 36 Z" />
              <path d="M46 25 L37 30 L46 36 Z" />
              <circle cx="37" cy="30.5" r="3.4" />
            </g>
          }
          @case ('glasses') {
            <g fill="rgba(255,255,255,.25)" stroke="#2a0f55" stroke-width="2.3">
              <circle cx="41" cy="51" r="7.3" />
              <circle cx="59" cy="51" r="7.3" />
            </g>
            <path d="M48.3 50 Q50 48.6 51.7 50" stroke="#2a0f55" stroke-width="2.3" fill="none" />
          }
          @case ('cap') {
            <path d="M24 42 Q25 18 50 18 Q75 18 76 42 Q62 35 50 35 Q38 35 24 42 Z" [attr.fill]="a.accent" />
            <path d="M50 37 Q72 34 86 40 Q84 45 74 44 Q62 41 50 42 Z" [attr.fill]="a.accent" />
            <circle cx="50" cy="19" r="2.6" fill="#fff" opacity=".7" />
          }
          @case ('headband') {
            <path d="M26 41 Q50 22 74 41" [attr.stroke]="a.accent" stroke-width="5" fill="none" stroke-linecap="round" />
          }
        }
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      line-height: 0;
      border-radius: 50%;
    }
    svg {
      border-radius: 50%;
    }
  `,
})
export class AvatarComponent {
  readonly avatar = input<string | null | undefined>('');
  readonly seed = input<string>('');
  readonly size = input<number | string>(48);
  readonly label = input('');

  protected readonly def = computed(() => resolveAvatar(this.avatar(), this.seed()));
  protected readonly clipId = `ek-avatar-clip-${++avatarCounter}`;
}
