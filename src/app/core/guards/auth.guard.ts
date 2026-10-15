import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { stripAuthCallbackParams, hasAuthCallbackError } from '@claro/auth';

import { stripAuthCallbackFromLocation, toRouterUrl } from '../auth/strip-auth-callback';
import { AppLoadingService } from '../services/app-loading.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export const authGuard: CanActivateFn = async (_route, state) => {
  const appLoading = inject(AppLoadingService);

  // Omitir temporalmente la validacion de Keycloak solo en desarrollo local.
  // En produccion y en hosts remotos se mantiene el flujo de autenticacion.
  if (
    !environment.production &&
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  ) {
    appLoading.markInitialReady();
    return true;
  }

  const authService = inject(AuthService);
  const router = inject(Router);

  const authenticated = await authService.init();

  if (authenticated) {
    appLoading.markInitialReady();

    // Limpieza de la URL del callback. Idempotente: AuthService.init() ya la
    // hace tras el canje del code, y se repite aqui para cubrir el caso en que
    // init() se haya resuelto desde un caminho que no pasa por el servicio.
    //
    // Antes esta rama devolvia `router.parseUrl(cleanUrl)` con una URL ABSOLUTA
    // (window.location.href filtrada). El serializador de Angular segmenta por
    // `/` y trata `https:` y el host como segmentos de la ruta, de modo que la
    // navegacion no correspondia a ninguna ruta: caia en el catch-all `**`,
    // redirigia a `''`, el guard volvia a correr y se producia un bucle de
    // redireccion. replaceState evita esa navegacion por completo.
    stripAuthCallbackFromLocation();

    return true;
  }

  // A los helpers de @claro/auth se les sigue pasando una URL absoluta porque
  // ese es el contrato con el que fueron implementados. Solo la salida que
  // consume el router se normaliza a URL relativa.
  const targetUrl = resolveAppUrl(state.url);
  const targetUrlString = targetUrl.toString();

  if (hasAuthCallbackError(targetUrlString)) {
    appLoading.markInitialReady();

    // Se limpia antes de navegar para que el authorization code no quede en el
    // historial accesible con el boton atras de la pagina de error.
    stripAuthCallbackFromLocation();

    // returnTo viaja como query param hacia AuthErrorComponent, que solo lo
    // acepta si empieza por `/` (auth-error.component.ts). Sin esta
    // normalizacion recibe una URL absoluta, el componente la descarta y el
    // usuario pierde la ruta a la que intentaba volver.
    const returnTo = toRouterUrl(stripAuthCallbackParams(targetUrlString));

    return router.createUrlTree(['/auth/error'], {
      queryParams: returnTo !== '/auth/error' ? { returnTo } : undefined
    });
  }

  authService.login(state.url);
  return false;
};

function resolveAppUrl(url: string): URL {
  const baseUrl = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  return new URL(url, baseUrl);
}
