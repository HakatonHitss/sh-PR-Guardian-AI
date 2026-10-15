type FederationManifest = Record<string, string>;

let federationManifestPromise: Promise<FederationManifest | null> | null = null;

function getDocumentBaseUrl(): string {
  if (typeof document !== 'undefined') {
    return document.baseURI;
  }

  if (typeof window !== 'undefined') {
    return window.location.href;
  }

  return 'http://localhost/';
}

export async function loadFederationManifest(): Promise<FederationManifest | null> {
  federationManifestPromise ??= fetch(new URL('federation.manifest.json', getDocumentBaseUrl()))
    .then(async (response) => (response.ok ? ((await response.json()) as FederationManifest) : null))
    .catch(() => null);

  return federationManifestPromise;
}

export async function resolveRemoteEntryUrl(remoteName: string): Promise<string | null> {
  const federationManifest = await loadFederationManifest();
  const remoteEntry = federationManifest?.[remoteName];
  if (!remoteEntry) {
    return null;
  }

  const remoteEntryUrl = new URL(remoteEntry, getDocumentBaseUrl());

  if (remoteEntryUrl.pathname.endsWith('/')) {
    return new URL('remoteEntry.json', remoteEntryUrl).toString();
  }

  return remoteEntryUrl.toString();
}

export async function resolveRemoteBaseUrl(remoteName: string): Promise<string | null> {
  const remoteEntryUrl = await resolveRemoteEntryUrl(remoteName);
  return remoteEntryUrl ? new URL('./', remoteEntryUrl).toString() : null;
}
