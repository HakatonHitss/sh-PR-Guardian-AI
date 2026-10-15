import { InjectionToken } from '@angular/core';
import { IKeycloakConfig } from '@claro/auth';

export const KEYCLOAK_CONFIG = new InjectionToken<IKeycloakConfig>('KEYCLOAK_CONFIG');
