export const environment = {
  production: true,
  AUTH_STORAGE_SECRET_KEY: 'sh-pr-guardian-ai-auth-session-storage',
  keycloak: {
    url: 'https://auth.production-domain',
    realm: 'master',
    clientId: 'sh-angular',
    redirectUri: 'https://production-domain/',
    postLogoutRedirectUri: 'https://production-domain/',
    scope: 'openid profile email',
    storage: 'session'
  }
};
