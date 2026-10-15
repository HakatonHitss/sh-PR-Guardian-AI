import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZonelessChangeDetection
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { registerGlobalAuthBridge } from '@claro/http';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { KEYCLOAK_CONFIG } from './core/config/keycloak.config';
import { AuthService } from './core/services/auth.service';

function initializeAuth(): void {
  const authService = inject(AuthService);
  registerGlobalAuthBridge(() => authService.getAuthHeaders());
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    { provide: KEYCLOAK_CONFIG, useValue: environment.keycloak },
    provideAppInitializer(initializeAuth)
  ]
};
