import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { setFallbackState } from '../../features/fallback/fallback-state';
import { AppLoadingService } from '../services/app-loading.service';
import { ensureRemoteStylesheet } from './ensure-remote-stylesheet';
import { loadRemoteWithRxRetry } from './load-remote-with-rx-retry';

type RemoteRoutesModule = {
  routes: Routes;
};

export interface FederatedRouteLoaderOptions {
  remoteName: string;
  exposedModule: string;
  fallbackPath: string;
  retries?: number;
}

export function loadFederatedRoutes(options: FederatedRouteLoaderOptions): Promise<Routes> {
  const router = inject(Router);
  const appLoading = inject(AppLoadingService);
  const navigationId = router.currentNavigation()?.id ?? null;
  const retries = options.retries ?? 3;

  return runForActiveNavigation(router, navigationId, async () => {
    appLoading.setRemoteLoading(true);

    try {
      await ensureRemoteStylesheet(options.remoteName);

      const remoteModule = await loadRemoteWithRxRetry<RemoteRoutesModule>(
        {
          remoteName: options.remoteName,
          exposedModule: options.exposedModule
        },
        retries
      );

      return remoteModule.routes;
    } catch (error: unknown) {
      setFallbackState({
        remoteName: options.remoteName,
        path: options.fallbackPath,
        retries,
        failedAt: Date.now(),
        reason: error instanceof Error ? error.message : String(error)
      });

      return loadFallbackRoutes();
    } finally {
      appLoading.setRemoteLoading(false);
    }
  });
}

async function runForActiveNavigation(
  router: Router,
  navigationId: number | null,
  loadRoutes: () => Promise<Routes>
): Promise<Routes> {
  await Promise.resolve();

  const pendingNavigation = router.currentNavigation();
  if (
    navigationId !== null &&
    pendingNavigation !== null &&
    pendingNavigation.id !== navigationId
  ) {
    return [];
  }

  return loadRoutes();
}

async function loadFallbackRoutes(): Promise<Routes> {
  const { FallbackComponent } = await import('../../features/fallback/fallback.component');

  return [
    {
      path: '',
      component: FallbackComponent
    }
  ];
}
