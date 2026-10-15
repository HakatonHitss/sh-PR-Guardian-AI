import { initFederation } from '@angular-architects/native-federation';
import { environment } from './environments/environment';

type AngularDevGlobal = typeof globalThis & {
  ngDevMode?: boolean;
};

const angularGlobal = globalThis as AngularDevGlobal;

if (!environment.production && typeof angularGlobal.ngDevMode === 'undefined') {
  angularGlobal.ngDevMode = true;
}

initFederation({})
  .catch((err) => console.error(err))
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));
