// Angular 20 con provideZonelessChangeDetection() no necesita zone.js, y
// platformBrowserTesting() tampoco lo requiere.
//
// Se eliminaron los imports de 'zone.js' y 'zone.js/testing' que estaban aqui:
// zone.js no estaba declarado en package.json, asi que cualquier test fallaba por
// modulo inexistente, y en una app zoneless esos imports son ademas
// conceptualmente incorrectos. El fallo pasaba inadvertido porque
// vitest.config.ts traia passWithNoTests: true y no habia ni un solo spec.
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting()
);
