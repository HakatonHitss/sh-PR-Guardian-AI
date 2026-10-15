/**
 * Utilidades para tratar los parametros que Keycloak devuelve en el callback del
 * Authorization Code Flow (code, state, session_state, iss).
 *
 * CONTEXTO (Vulnerabilidad 5, CWE-598 - Informacion sensible en la URL)
 * Esos parametros viajan en la query porque es lo que exige el protocolo. No se
 * pueden eliminar sin romper el flujo, y `state` en concreto es el token
 * anti-CSRF: quitarlo seria empeorar la seguridad. Lo que si se controla son los
 * canales por los que se propagan: este modulo cierra el de la barra de
 * direcciones y el del historial del navegador.
 *
 * El canal del log de acceso se cierra aparte, en nginx/nginx.conf, porque
 * ocurre antes de que este codigo llegue a ejecutarse.
 */

/** Parametros estandar del callback OIDC/OAuth2 que no deben quedar en la URL. */
export const AUTH_CALLBACK_PARAMS = ['code', 'state', 'session_state', 'iss'] as const;

/**
 * Elimina del historial del navegador los parametros del callback OIDC.
 *
 * INVARIANTE CRITICO: solo puede invocarse DESPUES de que el `code` se haya
 * canjeado por un token. `KeycloakRedirectAuth` lee el `code` de la URL para
 * canjearlo; si esta funcion corre antes, la autenticacion nunca completa y el
 * guard entra en un loop de login. Por eso el llamador es `AuthService.init()`,
 * que es justo donde termina el canje, y NO `main.ts`, que corre antes del
 * bootstrap. No mover esta llamada al arranque sin revisar ese invariante.
 *
 * Se usa `replaceState` y no una navegacion del router a proposito: no crea una
 * entrada nueva en el historial, con lo que el `code` no queda accesible con el
 * boton atras, y no puede producir un bucle de redireccion.
 *
 * Es idempotente: si no hay parametros de callback, no toca el historial.
 */
export function stripAuthCallbackFromLocation(): void {
  if (typeof window === 'undefined' || typeof window.history?.replaceState !== 'function') {
    return;
  }

  const currentUrl = new URL(window.location.href);

  if (!stripAuthCallbackFromUrl(currentUrl)) {
    return;
  }

  window.history.replaceState(null, '', toRouterUrl(currentUrl));
}

/**
 * Elimina los parametros del callback de una URL mutandola in place.
 *
 * @returns `true` si se elimino al menos un parametro, `false` si la URL ya
 * estaba limpia. Permite a los llamadores evitar escrituras inutiles en el
 * historial.
 */
export function stripAuthCallbackFromUrl(url: URL): boolean {
  let changed = false;

  for (const param of AUTH_CALLBACK_PARAMS) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      changed = true;
    }
  }

  return changed;
}

/**
 * Convierte una URL absoluta en una URL de router (`ruta + query + fragment`).
 *
 * `Router.parseUrl()` y `AuthErrorComponent.returnTo` esperan una ruta relativa:
 * el serializador de Angular segmenta por `/` y trataria `https:` y el host
 * como si fueran segmentos de la ruta, con lo que la navegacion no corresponde a
 * ninguna ruta y cae en el catch-all `**`.
 *
 * Acepta tanto `URL` como `string` (absoluta o relativa) para no obligar a quien
 * llama a hacer el `new URL()` por su cuenta.
 */
export function toRouterUrl(input: string | URL, base?: string): string {
  const baseUrl =
    base ?? (typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  const url = input instanceof URL ? input : new URL(input, baseUrl);

  return `${url.pathname}${url.search}${url.hash}`;
}
