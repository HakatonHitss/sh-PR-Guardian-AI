import { beforeEach, describe, expect, it } from 'vitest';

import {
  AUTH_CALLBACK_PARAMS,
  stripAuthCallbackFromLocation,
  stripAuthCallbackFromUrl,
  toRouterUrl
} from './strip-auth-callback';

describe('stripAuthCallbackFromLocation', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('elimina los cuatro parametros del callback OIDC', () => {
    window.history.replaceState(
      null,
      '',
      '/buro?code=abc123&state=xyz&session_state=s1&iss=https%3A%2F%2Fkeycloak'
    );

    stripAuthCallbackFromLocation();

    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/buro');
  });

  it('conserva los parametros de query que no son del callback', () => {
    // Una app derivada puede usar query params propios en la misma ruta; el
    // scrub no debe borrarlos.
    window.history.replaceState(null, '', '/default?tab=2&code=abc123');

    stripAuthCallbackFromLocation();

    expect(window.location.search).toBe('?tab=2');
  });

  it('preserva la ruta y el fragmento', () => {
    window.history.replaceState(null, '', '/template/reportes?code=abc#seccion-3');

    stripAuthCallbackFromLocation();

    expect(window.location.pathname).toBe('/template/reportes');
    expect(window.location.hash).toBe('#seccion-3');
  });

  it('no agrega una entrada nueva al historial', () => {
    // Es la propiedad que justifica usar replaceState: el authorization code no
    // debe quedar accesible con el boton atras.
    window.history.replaceState(null, '', '/?code=abc123');
    const lengthBefore = window.history.length;

    stripAuthCallbackFromLocation();

    expect(window.history.length).toBe(lengthBefore);
  });

  it('es idempotente cuando la URL no tiene parametros de callback', () => {
    window.history.replaceState(null, '', '/default');
    const lengthBefore = window.history.length;

    stripAuthCallbackFromLocation();
    stripAuthCallbackFromLocation();

    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/default');
    expect(window.history.length).toBe(lengthBefore);
  });

  it('no toca la URL si no hay nada que limpiar', () => {
    window.history.replaceState(null, '', '/default?tab=2');

    stripAuthCallbackFromLocation();

    expect(window.location.search).toBe('?tab=2');
  });
});

describe('stripAuthCallbackFromUrl', () => {
  it('informa si modifico la URL', () => {
    const dirty = new URL('https://app.example.com/?code=abc');
    const clean = new URL('https://app.example.com/?tab=2');

    expect(stripAuthCallbackFromUrl(dirty)).toBe(true);
    expect(stripAuthCallbackFromUrl(clean)).toBe(false);
  });

  it('cubre exactamente los parametros definidos', () => {
    // Si Keycloak anade un parametro nuevo al callback, este test obliga a
    // revisar la lista en lugar de dejar el valor expuesto en la URL.
    expect([...AUTH_CALLBACK_PARAMS]).toEqual(['code', 'state', 'session_state', 'iss']);
  });
});

describe('toRouterUrl', () => {
  it('descarta el origen de una URL absoluta', () => {
    // Es la regresion que motivo el punto 1: Router.parseUrl() con una URL
    // absoluta segmentaba `https:` y el host como partes de la ruta, con lo que
    // la navegacion caia en el catch-all y el guard entraba en bucle.
    expect(toRouterUrl('https://app.example.com/default?tab=2#top')).toBe('/default?tab=2#top');
  });

  it('deja intacta una ruta ya relativa', () => {
    expect(toRouterUrl('/default?tab=2')).toBe('/default?tab=2');
  });

  it('acepta un objeto URL sin base', () => {
    expect(toRouterUrl(new URL('https://app.example.com/buro'))).toBe('/buro');
  });
});
