import { inject, InjectionToken } from '@angular/core';
import { KeycloakRedirectAuth } from '@claro/auth';
import { KEYCLOAK_CONFIG } from './keycloak.config';

export const AUTH_CLIENT = new InjectionToken<KeycloakRedirectAuth>('AUTH_CLIENT', {
  providedIn: 'root',
  factory: () => new KeycloakRedirectAuth(inject(KEYCLOAK_CONFIG))
});
