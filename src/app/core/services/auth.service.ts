import { Injectable, inject } from '@angular/core';
import { MessageBus } from '@claro/message-bus';
import { stripAuthCallbackFromLocation } from '../auth/strip-auth-callback';
import { AUTH_CLIENT } from '../config/auth-client.token';
import { EMessageBusChannel, EMessageBusTopic } from '../constants/message-bus.constants';
import { environment } from '../../../environments/environment';
import packageMetadata from '../../../../package.json';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly authClient = inject(AUTH_CLIENT);
  private readonly bus = MessageBus.getInstance();
  private lastBroadcastedToken?: string;
  private readonly appId = environment.keycloak.clientId;
  private readonly clientVersion = packageMetadata.version;

  public async init(): Promise<boolean> {
    try {
      const authenticated = await this.authClient.init();

      if (authenticated) {
        this.broadcastUserInfo();

        // Punto mas temprano en el que es seguro limpiar la URL del callback
        // (Vulnerabilidad 5): `authClient.init()` acaba de canjear el `code` por
        // un token, asi que los parametros OIDC ya cumplieron su funcion.
        //
        // NO mover esta llamada antes del canje ni a `main.ts`: `KeycloakRedirectAuth`
        // lee el `code` de la URL para canjearlo, y borrarlo antes haria que la
        // autenticacion nunca complete y el guard entre en loop de login.
        stripAuthCallbackFromLocation();
      }

      return authenticated;
    } catch (error) {
      console.error('[AuthService] Error initializing auth:', error);
      return false;
    }
  }

  public login(redirectUri?: string): void {
    void this.authClient.login(redirectUri).catch((error: unknown) => {
      console.error('[AuthService] Error starting login:', error);
    });
  }

  public getToken(): string {
    return this.authClient.getToken();
  }

  public getUser(): Record<string, unknown> {
    return this.authClient.getUser();
  }

  public async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'x-app-id': this.appId,
      'x-client-version-id': this.clientVersion
    };

    try {
      if (this.authClient.isExpired()) {
        const refreshed = await this.authClient.refresh();
        if (!refreshed) {
          return headers;
        }
      }

      const token = this.authClient.getToken();
      if (token) {
        headers['authorization'] = `Bearer ${token}`;
      }

      return headers;
    } catch (error) {
      console.error('[AuthService] Error resolving auth headers:', error);
      return headers;
    }
  }

  private broadcastUserInfo(): void {
    const token = this.authClient.getToken();
    if (!token || token === this.lastBroadcastedToken) {
      return;
    }

    try {
      const userInfo = this.authClient.getUser();
      this.bus.emit(EMessageBusChannel.AUTH, EMessageBusTopic.USER_INFO, userInfo);
      this.lastBroadcastedToken = token;
    } catch (error) {
      console.error('[AuthService] Error retrieving user info:', error);
    }
  }

  public logout(redirectUri?: string): void {
    this.lastBroadcastedToken = undefined;
    void this.authClient.logout(redirectUri).catch((error: unknown) => {
      console.error('[AuthService] Error during logout:', error);
    });
  }
}
