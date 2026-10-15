import {
  loadRemoteModule,
  type LoadRemoteModuleOptions
} from '@angular-architects/native-federation';
import { catchError, defer, from, lastValueFrom, retry, throwError, timer } from 'rxjs';
import { resolveRemoteEntryUrl } from './federation-manifest';

export async function loadRemoteWithRxRetry<T>(
  options: LoadRemoteModuleOptions,
  retries = 3,
  delayMs = 1500
): Promise<T> {
  const normalizedOptions = await withResolvedRemoteEntry(options);
  const remoteLabel =
    options.remoteName ?? normalizedOptions.remoteEntry ?? normalizedOptions.exposedModule;

  const obs$ = defer(() => from(loadRemoteModule<T>(normalizedOptions))).pipe(
    retry({
      count: Math.max(0, retries - 1),
      delay: (error, retryCount) => {
        console.warn(`Reintentando carga de ${remoteLabel} (${retryCount}/${retries})`, error);
        return timer(delayMs);
      }
    }),
    catchError((error) => {
      console.error(
        `Falló la carga de ${remoteLabel} después de ${retries} intentos`,
        error
      );
      return throwError(() => error);
    })
  );

  return lastValueFrom(obs$);
}

async function withResolvedRemoteEntry(
  options: LoadRemoteModuleOptions
): Promise<LoadRemoteModuleOptions> {
  if (options.remoteEntry) {
    const { remoteName: _unused, ...rest } = options;
    return rest;
  }

  if (!options.remoteName) {
    return options;
  }

  const remoteEntry = await resolveRemoteEntryUrl(options.remoteName);
  if (!remoteEntry) {
    return options;
  }

  const resolved: LoadRemoteModuleOptions = { exposedModule: options.exposedModule, remoteEntry };
  if (options.fallback) {
    resolved.fallback = options.fallback;
  }
  return resolved;
}
