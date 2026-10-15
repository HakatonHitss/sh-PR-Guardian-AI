export const environment = {
  production: false,
  applicationCode: 109,
  AUTH_STORAGE_SECRET_KEY: 'sh-pr-guardian-ai-auth-session-storage',
  keycloak: {
    url: 'https://keycloak.apps.ocdv.claro.pe',
    realm: 'workshop-realm',
    clientId: 'sh-recaudacion',
    redirectUri: 'https://sh-gestion-documentos-channel-miclaro-dev.apps.ocdv.claro.pe/',
    postLogoutRedirectUri: 'https://sh-gestion-documentos-channel-miclaro-dev.apps.ocdv.claro.pe/',
    scope: 'openid profile email',
    storage: 'session'
  }
};
