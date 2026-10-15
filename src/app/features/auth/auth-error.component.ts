import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppLoadingService } from '../../core/services/app-loading.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth-error',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="flex min-h-screen items-center justify-center bg-[var(--claro-gray-bg)] p-6">
      <article
        class="w-full max-w-md rounded-2xl border border-[var(--claro-border)] bg-[var(--claro-white)] p-6 shadow-sm"
      >
        <div class="mb-5 flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--claro-red)]/10 text-[var(--claro-red)]"
            aria-hidden="true"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h1 class="text-lg font-semibold text-[var(--claro-text-main)]">Error de autenticación</h1>
        </div>

        <p class="text-sm leading-6 text-[var(--claro-text-muted)]">
          No se pudo completar la autenticación de Keycloak. Puedes reintentar o volver al inicio.
        </p>

        <div class="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            (click)="retryLogin()"
            class="rounded-lg border-none bg-[var(--claro-red)] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--claro-red-dark)]"
          >
            Reintentar inicio de sesión
          </button>

          <a
            routerLink="/"
            class="text-sm font-semibold text-[var(--claro-red)] underline-offset-2 transition-colors hover:text-[var(--claro-red-dark)] hover:underline"
          >
            Ir al inicio
          </a>
        </div>
      </article>
    </section>
  `
})
export class AuthErrorComponent {
  private readonly appLoading = inject(AppLoadingService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    this.appLoading.markInitialReady();
  }

  retryLogin(): void {
    this.authService.login(this.returnTo);
  }

  private get returnTo(): string {
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    return returnTo?.startsWith('/') ? returnTo : '/';
  }
}
