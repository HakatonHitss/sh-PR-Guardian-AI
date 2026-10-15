import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { getFallbackState } from './fallback-state';

@Component({
  selector: 'app-sh-pr-guardian-ai-fallback',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-3 px-6 py-20 text-center"
    >
      <svg
        class="h-12 w-12 text-(--guardian-red)"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>

      <h2 class="text-lg font-semibold text-(--guardian-text-main)">Módulo no disponible</h2>

      <p class="text-sm text-(--guardian-text-muted)">
        No se pudo cargar <strong>{{ remoteName }}</strong> tras {{ retries }} intentos.
      </p>

      <p class="text-xs text-(--guardian-text-muted)">{{ reason }}</p>

      <div class="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button type="button" (click)="retry()" class="rounded-md bg-(--guardian-red) px-4 py-2 text-sm font-semibold text-white hover:bg-(--guardian-red-dark)">Reintentar</button>

        <a
          routerLink="/template"
          class="text-sm font-semibold text-(--guardian-red) underline-offset-2 transition-colors hover:text-(--guardian-red-dark) hover:underline"
        >
          Ir a consultas
        </a>
      </div>
    </section>
  `
})
export class FallbackComponent {
  private readonly router = inject(Router);

  readonly remoteName: string;
  readonly retries: number;
  readonly reason: string;

  private readonly path: string;

  constructor() {
    const state = getFallbackState();
    this.remoteName = state?.remoteName ?? 'template';
    this.retries = state?.retries ?? 3;
    this.path = state?.path ?? '/template';
    this.reason = state?.reason || 'Comprueba que el servidor del microfront-end está en ejecución.';
  }

  retry(): void {
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigateByUrl(this.path);
    });
  }
}
