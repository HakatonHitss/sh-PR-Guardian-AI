import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public async init(): Promise<boolean> {
    return true;
  }

  public login(_redirectUri?: string): void {
    return;
  }

  public getToken(): string {
    return '';
  }

  public getUser(): Record<string, unknown> {
    return {
      name: 'Administrador',
      email: 'admin@example.com'
    };
  }

  public async getAuthHeaders(): Promise<Record<string, string>> {
    return {};
  }

  public logout(_redirectUri?: string): void {
    return;
  }
}
