import { resolveRemoteBaseUrl, resolveRemoteEntryUrl } from './federation-manifest';

type RemoteAssetsManifest = {
  styles?: string[];
};

type StyleResolution =
  | {
      mode: 'all';
      hrefs: string[];
    }
  | {
      mode: 'fallback';
      hrefs: string[];
    };

const REMOTE_STYLESHEET_TIMEOUT_MS = 10000;

const stylesheetLoads = new Map<string, Promise<void>>();
const remoteAssetsManifestLoads = new Map<string, Promise<RemoteAssetsManifest | null>>();
const remoteEntryLoads = new Map<string, Promise<RemoteAssetsManifest | null>>();

export function ensureRemoteStylesheet(remoteName: string): Promise<void> {
  if (typeof document === 'undefined' || typeof fetch === 'undefined') {
    return Promise.resolve();
  }

  const pendingLoad = stylesheetLoads.get(remoteName);
  if (pendingLoad) {
    return pendingLoad;
  }

  const loadPromise = resolveRemoteStyles(remoteName)
    .then((resolution) =>
      resolution.mode === 'all'
        ? ensureStylesheets(remoteName, resolution.hrefs)
        : loadFirstAvailableStylesheet(remoteName, resolution.hrefs)
    )
    .catch((error: unknown) => {
      console.warn(`No se pudieron resolver los estilos del remoto ${remoteName}`, error);
    });

  stylesheetLoads.set(remoteName, loadPromise);
  return loadPromise;
}

async function resolveRemoteStyles(remoteName: string): Promise<StyleResolution> {
  const remoteEntryUrl = await resolveRemoteEntryUrl(remoteName);
  const remoteBaseUrl = await resolveRemoteBaseUrl(remoteName);
  if (!remoteEntryUrl || !remoteBaseUrl) {
    return {
      mode: 'all',
      hrefs: []
    };
  }

  const remoteEntry = await loadRemoteEntry(remoteEntryUrl);
  if (remoteEntry?.styles?.length) {
    return {
      mode: 'all',
      hrefs: normalizeStyles(remoteEntry.styles, remoteBaseUrl)
    };
  }

  const remoteAssets = await loadRemoteAssetsManifest(remoteBaseUrl);
  if (remoteAssets?.styles?.length) {
    return {
      mode: 'all',
      hrefs: normalizeStyles(remoteAssets.styles, remoteBaseUrl)
    };
  }

  return {
    mode: 'fallback',
    hrefs: [
      new URL('styles.css', remoteBaseUrl).toString(),
      new URL('style.css', remoteBaseUrl).toString()
    ]
  };
}

async function loadRemoteEntry(remoteEntryUrl: string): Promise<RemoteAssetsManifest | null> {
  let pendingLoad = remoteEntryLoads.get(remoteEntryUrl);
  if (!pendingLoad) {
    pendingLoad = fetch(remoteEntryUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`No se pudo cargar remoteEntry ${remoteEntryUrl}: ${response.status}`);
        }

        return (await response.json()) as RemoteAssetsManifest;
      })
      .then((manifest) => (Array.isArray(manifest?.styles) ? manifest : null))
      .catch((error: unknown) => {
        console.warn(
          `No se pudieron resolver estilos desde remoteEntry para ${remoteEntryUrl}.`,
          error
        );
        return null;
      });

    remoteEntryLoads.set(remoteEntryUrl, pendingLoad);
  }

  return pendingLoad;
}

async function loadRemoteAssetsManifest(remoteBaseUrl: string): Promise<RemoteAssetsManifest | null> {
  let pendingLoad = remoteAssetsManifestLoads.get(remoteBaseUrl);
  if (!pendingLoad) {
    pendingLoad = fetch(new URL('remote-assets.json', remoteBaseUrl))
      .then(async (response) => {
        if (!response.ok) {
          console.warn(
            `No se encontro remote-assets.json para ${remoteBaseUrl}. Se usara fallback de nombres conocidos.`
          );
          return null;
        }

        return (await response.json()) as RemoteAssetsManifest;
      })
      .then((manifest) => (Array.isArray(manifest?.styles) ? manifest : null))
      .catch((error: unknown) => {
        console.warn(
          `No se pudo cargar remote-assets.json para ${remoteBaseUrl}. Se usara fallback de nombres conocidos.`,
          error
        );
        return null;
      });

    remoteAssetsManifestLoads.set(remoteBaseUrl, pendingLoad);
  }

  return pendingLoad;
}

function normalizeStyles(styles: string[], remoteBaseUrl: string): string[] {
  const unique = new Set(
    styles
      .map((href) => new URL(href, remoteBaseUrl).toString())
      .filter((href) => href.length > 0)
  );

  return Array.from(unique);
}

async function ensureStylesheets(remoteName: string, hrefs: string[]): Promise<void> {
  await Promise.all(
    hrefs.map(async (href) => {
      if (findExistingStylesheet(remoteName, href)) {
        return;
      }

      await injectStylesheet(remoteName, href);
    })
  );
}

async function loadFirstAvailableStylesheet(
  remoteName: string,
  hrefs: string[]
): Promise<void> {
  for (const href of hrefs) {
    if (findExistingStylesheet(remoteName, href)) {
      return;
    }

    try {
      await injectStylesheet(remoteName, href);
      return;
    } catch (error) {
      console.warn(`No se pudo cargar la hoja de estilos ${href} para ${remoteName}`, error);
    }
  }
}

function findExistingStylesheet(remoteName: string, href: string): HTMLLinkElement | null {
  return document.head.querySelector(
    `link[rel="stylesheet"][data-remote-style="${remoteName}"][href="${href}"]`
  );
}

function injectStylesheet(remoteName: string, href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    let timeoutId: ReturnType<typeof window.setTimeout>;

    const cleanup = (): void => {
      window.clearTimeout(timeoutId);
      link.onload = null;
      link.onerror = null;
    };

    link.rel = 'stylesheet';
    link.href = href;
    link.dataset['remoteStyle'] = remoteName;
    link.onload = () => {
      cleanup();
      resolve();
    };
    link.onerror = () => {
      cleanup();
      link.remove();
      reject(new Error(`No fue posible cargar ${href}`));
    };

    timeoutId = window.setTimeout(() => {
      cleanup();
      link.remove();
      reject(new Error(`Se agoto el tiempo de carga de la hoja de estilos ${href}`));
    }, REMOTE_STYLESHEET_TIMEOUT_MS);

    document.head.appendChild(link);
  });
}
