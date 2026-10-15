# sh-PR-Guardian-AI

Shell desarrollado con **Angular 20** y **Native Federation**, diseñado como arquetipo corporativo para la construcción de soluciones basadas en Micro Frontends (MFE).

El proyecto proporciona una base común para que los equipos puedan implementar nuevos Shells, integrar micrositios remotos y reutilizar capacidades transversales como autenticación, navegación, comunicación entre aplicaciones y controles de seguridad.

## Capacidades principales

- Autenticación centralizada mediante Keycloak.
- Rutas protegidas mediante guards.
- Layout y navegación base.
- Menú lateral y breadcrumbs.
- Native Federation.
- Carga dinámica de Micro Frontends.
- Message Bus corporativo.
- Manejo de errores y componentes fallback.
- Integración con librerías `@claro/*`.
- Tailwind CSS 4.
- Angular 20 Standalone.
- Detección de cambios sin `zone.js`.
- Content Security Policy estricta con nonce dinámico.
- Ejecución no-root compatible con OpenShift.

---

## Arquitectura

```text
┌────────────────────────────────┐
│         sh-PR-Guardian-AI         │
├────────────────────────────────┤
│ Autenticación Keycloak         │
│ Layout y navegación            │
│ Menú y breadcrumbs             │
│ Message Bus                    │
│ Native Federation              │
│ Manejo de errores              │
│ Content Security Policy        │
└────────────────┬───────────────┘
                 │
                 ▼
        Micro Frontends (MFE)
```

El Shell puede ejecutarse sin Micro Frontends registrados.

Los proyectos consumidores del arquetipo deben registrar únicamente los remotos que requieran para su implementación.

---

## Qué incluye el Shell

| Área | Descripción |
|---|---|
| Autenticación | Login, logout, sesión y renovación de token mediante Keycloak |
| Routing | Rutas protegidas mediante `authGuard` |
| Federation | Infraestructura para registrar y cargar Micro Frontends |
| Message Bus | Comunicación desacoplada entre el Shell y los MFEs |
| Layout | Menú lateral, navegación y breadcrumbs |
| Loading | Pantalla de carga previa y posterior al bootstrap de Angular |
| Fallback | Manejo controlado de errores cuando un remoto no está disponible |
| Seguridad | CSP estricta, cabeceras de seguridad y ejecución no-root |
| Observabilidad | Logs de acceso y recepción de reportes CSP en modo diagnóstico |

---

# Requisitos previos

## Node.js

Versión recomendada:

```text
Node.js 20 LTS
```

El proyecto también puede ser compatible con Node.js 22, sujeto a las versiones utilizadas por Angular CLI y las dependencias corporativas.

## npm

El proyecto utiliza `npm` como gestor de dependencias.

## Acceso al Nexus corporativo

El archivo `.npmrc` apunta al registro interno utilizado para resolver paquetes corporativos.

Ejemplo:

```properties
registry=http://<NEXUS>/repository/npm-public/
```

Las dependencias bajo el scope:

```text
@claro/*
```

requieren conectividad con la red corporativa y acceso al repositorio correspondiente.

No deben almacenarse tokens, contraseñas ni credenciales directamente en el repositorio.

---

# Instalación

## 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd sh-pr-guardian-ai
```

## 2. Instalar dependencias

```bash
npm install
```

Si la instalación presenta errores `401`, `404`, `ETIMEDOUT` o problemas de resolución de paquetes `@claro/*`, verificar:

- Conexión a la red corporativa.
- VPN.
- Configuración de `.npmrc`.
- Disponibilidad del Nexus interno.
- Credenciales de acceso, si correspondiera.

## 3. Ejecutar localmente

```bash
npm run dev
```

o:

```bash
npm start
```

La URL local debe ser informada por Angular CLI al finalizar la compilación.

La configuración actual utiliza normalmente:

```text
http://localhost:4201/
```

Si se utiliza un puerto diferente, deben actualizarse las URLs de redirección en:

```text
src/environments/environment.development.ts
```

y en la configuración del cliente de Keycloak.

---

# Configuración por ambiente

## Desarrollo local

La configuración local se encuentra en:

```text
src/environments/environment.development.ts
```

Este archivo se utiliza cuando Angular ejecuta la configuración `development`, según los `fileReplacements` definidos en `angular.json`.

## Build de producción

La configuración de producción se encuentra en:

```text
src/environments/environment.ts
```

La imagen Docker recibe la URL pública del microfrontend como argumento de build.
El valor se escribe en `federation.manifest.json` antes de generar la CSP, por lo
que ambos artefactos quedan alineados:

```bash
docker build \
  --build-arg ENV=production \
  --build-arg REMOTE_TEMPLATE_URL=https://mfe.example.com/remoteEntry.json \
  -t sh-pr-guardian-ai .
```

No omitas `REMOTE_TEMPLATE_URL` en despliegues que cargan el remoto: el valor
incluido en el repositorio (`http://localhost:4211`) solo es apropiado para
desarrollo local.

El pipeline genera actualmente el build con:

```bash
ng build --configuration=production
```

Por tanto, las aplicaciones desplegadas en OpenShift utilizan los valores de:

```text
src/environments/environment.ts
```

salvo que el proyecto consumidor modifique explícitamente la configuración de Angular.

---

# Configuración de Keycloak

La configuración se define dentro de los archivos `environment`.

Ejemplo:

```ts
export const environment = {
  production: true,
  AUTH_STORAGE_SECRET_KEY: 'sh-pr-guardian-ai-auth-session-storage',
  keycloak: {
    url: 'https://keycloak.apps.ocdv.claro.pe',
    realm: 'workshop-realm',
    clientId: 'sh-angular',
    redirectUri: 'https://mi-shell.apps.ocdv.claro.pe/',
    postLogoutRedirectUri: 'https://mi-shell.apps.ocdv.claro.pe/',
    scope: 'openid profile email',
    storage: 'session'
  }
};
```

Las siguientes propiedades deben coincidir con el cliente registrado en Keycloak:

```text
url
realm
clientId
redirectUri
postLogoutRedirectUri
```

Una diferencia entre la URL real del Shell y las URLs registradas puede provocar:

- Errores de redirección.
- Callback inválido.
- Ciclos de autenticación.
- Problemas durante el logout.
- Retorno hacia otro proyecto o ambiente.

## Flujo de autenticación

El flujo esperado es:

```text
Usuario
   ↓
Shell
   ↓
Auth Guard
   ↓
Keycloak
   ↓
Callback OIDC
   ↓
Canje del authorization code
   ↓
Shell autenticado
```

Keycloak puede devolver parámetros como:

```text
code
state
session_state
iss
```

Estos parámetros forman parte del flujo OIDC y no deben eliminarse antes del canje del código por tokens.

La limpieza de la URL debe realizarse únicamente después de completar el proceso de autenticación.

---

# Native Federation

El Shell incluye infraestructura para Native Federation, aunque por defecto no registra ningún Micro Frontend remoto.

El manifiesto base debe permanecer vacío:

```json
{}
```

Archivo:

```text
src/public/federation.manifest.json
```

El Shell debe poder iniciar, autenticar y mostrar sus vistas locales sin depender de un remoto adicional.

---

# Integración de un nuevo Micro Frontend

## Paso 1: registrar el remoto

Editar:

```text
src/public/federation.manifest.json
```

Ejemplo:

```json
{
  "ventas": "https://ventas-dev.apps.ocdv.claro.pe/remoteEntry.json"
}
```

El nombre `ventas` será el identificador utilizado por el Shell para resolver el remoto.

## Paso 2: registrar la ruta federada

Editar:

```text
src/app/app.routes.ts
```

Agregar la ruta correspondiente:

```ts
{
  path: 'ventas',
  loadChildren: () =>
    loadFederatedRoutes({
      remoteName: 'ventas',
      exposedModule: './Routes',
      fallbackPath: '/ventas',
      retries: 3
    })
}
```

También debe incorporarse el import requerido:

```ts
import { loadFederatedRoutes } from './core/federation/load-federated-routes';
```

Sonar puede reportar este import si se agrega antes que la ruta. El import debe existir únicamente cuando `loadFederatedRoutes` sea utilizado.

## Paso 3: agregar la opción de menú

Editar:

```text
src/app/features/dashboard/dashboard.component.ts
```

Agregar el elemento al arreglo de opciones del menú:

```ts
{
  path: '/ventas',
  label: 'Ventas',
  route: '/ventas'
}
```

El nombre y estructura exactos deben alinearse con el contrato utilizado por el componente de navegación.

## Paso 4: desplegar el MFE

El Micro Frontend debe publicar:

```text
remoteEntry.json
```

Si el remoto requiere cargar hojas de estilo emitidas durante su build, también puede publicar:

```text
remote-assets.json
```

El Shell utilizará ese archivo para resolver los recursos asociados al remoto, según la implementación de Federation del proyecto.

## Paso 5: actualizar la CSP

Los orígenes registrados en `federation.manifest.json` son procesados automáticamente durante el Docker Build.

El script:

```text
scripts/generate-csp.mjs
```

obtiene el origen de cada remoto y lo agrega explícitamente a `script-src`.

Por ejemplo, esta entrada:

```json
{
  "ventas": "https://ventas-dev.apps.ocdv.claro.pe/remoteEntry.json"
}
```

produce una política equivalente a:

```text
script-src 'self' blob: 'nonce-<valor>' https://ventas-dev.apps.ocdv.claro.pe
```

No deben agregarse manualmente comodines como:

```text
*
https:
```

## Paso 6: validar antes de `enforce`

Cuando se agregue un nuevo remoto o se actualicen dependencias relacionadas con Federation, se recomienda:

1. Generar temporalmente la CSP en modo `report-only`.
2. Desplegar en Desarrollo.
3. Probar el Shell y el remoto.
4. Revisar Console y `/csp-report`.
5. Corregir cualquier violación.
6. Regresar la CSP al modo `enforce`.

---

# Consideraciones sobre `federation.manifest.json`

El manifiesto debe contener únicamente remotos reales y accesibles desde el navegador del usuario.

Ejemplo válido:

```json
{
  "ventas": "https://ventas-dev.apps.ocdv.claro.pe/remoteEntry.json",
  "pagos": "https://pagos-dev.apps.ocdv.claro.pe/remoteEntry.json"
}
```

## No utilizar `localhost` en ambientes desplegados

Configuración incorrecta:

```json
{
  "ventas": "http://localhost:4211/remoteEntry.json"
}
```

Cuando la aplicación está desplegada, el navegador interpreta `localhost` como la computadora del usuario, no como OpenShift ni como el servidor del Shell.

Esto puede provocar:

- Error al descargar `remoteEntry.json`.
- Violaciones CSP.
- Reintentos innecesarios.
- Activación del fallback.
- Mensajes de módulo no disponible.
- Bloqueos por contenido mixto entre HTTPS y HTTP.

El generador CSP rechaza por defecto remotos locales durante el build.

Para validaciones locales controladas puede utilizarse:

```bash
--allow-localhost
```

Este argumento no debe utilizarse en imágenes destinadas a ambientes desplegados.

---

# Content Security Policy

La aplicación utiliza una Content Security Policy estricta en modo:

```text
enforce
```

La política se genera automáticamente durante el Docker Build mediante:

```text
scripts/generate-csp.mjs
```

La CSP no debe escribirse manualmente dentro de `nginx.template`.

## Arquitectura del nonce

NGINX utiliza:

```text
$request_id
```

como valor diferente para cada respuesta HTML.

El mismo valor se incorpora de forma coordinada en:

- La cabecera `Content-Security-Policy`.
- El elemento raíz de Angular mediante `ngCspNonce`.
- El atributo `nonce` del bloque `esms-options`.
- La configuración interna de `es-module-shims`.
- Los import maps dinámicos requeridos por Native Federation.

Flujo:

```text
Solicitud HTTP
      ↓
NGINX genera $request_id
      ↓
CSP recibe nonce-$request_id
      ↓
sub_filter reemplaza __CSP_NONCE__
      ↓
Angular recibe ngCspNonce
      ↓
es-module-shims recibe el mismo nonce
      ↓
Native Federation ejecuta sus scripts autorizados
```

## Archivos involucrados

| Archivo | Responsabilidad |
|---|---|
| `src/index.html` | Declara `ngCspNonce="__CSP_NONCE__"` y el estilo crítico |
| `scripts/generate-csp.mjs` | Configura el nonce de `esms-options` y genera la CSP |
| `nginx/nginx.template` | Sustituye `__CSP_NONCE__` por `$request_id` |
| `Dockerfile` | Genera y copia `csp-headers.conf` |
| `nginx/nginx.conf` | Configuración global de NGINX |
| `nginx/docker-entrypoint.sh` | Genera la configuración activa del servidor |
| `csp-headers.conf` | Artefacto generado durante el build, no versionado |

## Política de scripts

La directiva final utiliza:

```text
script-src 'self' blob: 'nonce-<valor-por-respuesta>'
```

La política no utiliza:

```text
'unsafe-inline'
'unsafe-eval'
*
https:
```

Los atributos ejecutables como `onclick` y `onerror` se bloquean mediante:

```text
script-src-attr 'none'
```

## Política de estilos

El bloque:

```html
<style id="csp-critical">
```

se autoriza mediante un hash SHA-256 calculado durante el build.

Los estilos globales generados por `@claro/ui` se autorizan mediante un hash controlado.

Los atributos HTML de estilo se bloquean mediante:

```text
style-src-attr 'none'
```

Si se actualiza `@claro/ui`, debe validarse nuevamente el hash del estilo runtime.

## Modo `report-only`

El generador mantiene soporte para:

```text
Content-Security-Policy-Report-Only
```

Este modo debe utilizarse temporalmente cuando:

- Se actualice Angular.
- Se actualice Native Federation.
- Se actualice `es-module-shims`.
- Se actualice `@claro/ui`.
- Se agregue un nuevo MFE.
- Se modifiquen scripts o estilos inline.
- Se cambie la configuración de NGINX.

En modo `report-only`, las violaciones se envían a:

```text
/csp-report
```

La aplicación no debe permanecer permanentemente en este modo en ambientes finales.

## Validación local de la CSP

Compilar la aplicación:

```bash
npm run build
```

Generar una CSP de diagnóstico:

```bash
node scripts/generate-csp.mjs \
  --index dist/sh-pr-guardian-ai/browser/index.html \
  --manifest dist/sh-pr-guardian-ai/browser/federation.manifest.json \
  --out ./csp-headers.conf \
  --mode report-only
```

Generar una CSP efectiva:

```bash
node scripts/generate-csp.mjs \
  --index dist/sh-pr-guardian-ai/browser/index.html \
  --manifest dist/sh-pr-guardian-ai/browser/federation.manifest.json \
  --out ./csp-headers.conf \
  --mode enforce
```

El archivo local:

```text
csp-headers.conf
```

es un artefacto generado y no debe versionarse.

---

# NGINX y OpenShift

La imagen se prepara para ejecutarse como usuario no-root.

El Dockerfile aplica permisos compatibles con OpenShift sobre:

```text
/usr/share/nginx
/var/cache/nginx
/var/run
/var/log/nginx
/etc/nginx
```

El contenedor se ejecuta con:

```dockerfile
USER 101
```

## Dependencia de `sub_filter`

La solución nonce depende del módulo:

```text
ngx_http_sub_module
```

El Dockerfile valida que la imagen NGINX incluya soporte para ese módulo.

Si la imagen base cambia y el módulo deja de estar disponible, el Docker Build debe fallar antes de publicar una imagen inválida.

## Configuración activa

El archivo:

```text
nginx/nginx.template
```

se copia a:

```text
/etc/nginx/templates/default.conf.template
```

El entrypoint genera posteriormente:

```text
/etc/nginx/conf.d/default.conf
```

No deben incluirse entidades HTML como:

```text
&nbsp;
```

dentro de archivos NGINX.

---

# Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor local con configuración de desarrollo |
| `npm start` | Servidor local |
| `npm run build` | Build de producción |
| `npm run watch` | Build incremental |
| `npm test` | Ejecución de pruebas unitarias |
| `npm run coverage` | Pruebas con cobertura |
| `npm run lint` | Validación ESLint |
| `npm run clean` | Limpieza de dependencias y caché Angular, según el script configurado |

---

# Lista de configuración antes del despliegue

## Keycloak

Revisar:

```text
src/environments/environment.ts
```

Validar:

```text
url
realm
clientId
redirectUri
postLogoutRedirectUri
scope
storage
```

## Native Federation

Revisar:

```text
src/public/federation.manifest.json
```

Validar que:

- Los remotos existan.
- Utilicen HTTPS en ambientes desplegados.
- No apunten a `localhost`.
- Publiquen `remoteEntry.json`.
- Sus orígenes sean compatibles con la política CSP generada.

## Docker

Revisar:

```text
Dockerfile
nginx/nginx.conf
nginx/nginx.template
nginx/docker-entrypoint.sh
scripts/generate-csp.mjs
scripts/write-federation-manifest.mjs
```

Validar que el Dockerfile utilice:

```text
--mode enforce
```

para el despliegue definitivo.

## OpenShift

Revisar:

```text
configs/base
```

Archivos habituales:

```text
deployment.yml.j2
service.yml.j2
Route.yml.j2
kustomization.yml.j2
ServiceAccount.yml.j2
hpa.yml.j2
pdb.yml.j2
```

La estructura exacta debe alinearse con los estándares vigentes del entorno.

---

# Validaciones posteriores al despliegue

## Validación funcional

- Acceso a la URL principal.
- Redirección a Keycloak.
- Inicio de sesión.
- Retorno al Shell.
- Navegación por vistas locales.
- Carga de Micro Frontends registrados.
- Manejo de fallback.
- Renovación del token.
- Cierre de sesión.
- Segundo inicio de sesión.

## Validación CSP

Desde DevTools debe comprobarse que:

- Existe `Content-Security-Policy`.
- No existe `Content-Security-Policy-Report-Only` en el despliegue definitivo.
- `script-src` contiene un nonce.
- No existe `unsafe-inline`.
- No existe `unsafe-eval`.
- No existen recursos con estado `(blocked:csp)`.
- Console no presenta violaciones CSP.

## Validación de seguridad

Después de cambios relevantes en CSP, NGINX, Federation o dependencias corporativas, ejecutar nuevamente el análisis OWASP/ZAP.

El estado esperado del arquetipo es:

```text
Alertas altas: 0
Alertas medias: 0
Alertas bajas: 0
```

---

# Mantenimiento

Cuando se actualicen dependencias relevantes:

```text
Angular
Native Federation
es-module-shims
@claro/ui
Keycloak SDK
```

se debe:

1. Generar la CSP en modo `report-only`.
2. Desplegar en Desarrollo.
3. Ejecutar el flujo funcional completo.
4. Revisar Console y `/csp-report`.
5. Actualizar hashes de estilos si correspondiera.
6. Regresar a `enforce`.
7. Ejecutar OWASP/ZAP.

---

# Observaciones finales

- El Shell puede ejecutarse sin ningún MFE registrado.
- Native Federation permanece disponible para los proyectos consumidores.
- La autenticación se centraliza en el Shell.
- Los Micro Frontends no deben implementar un flujo de login independiente.
- Los remotos deben registrarse explícitamente por ambiente.
- No deben configurarse remotos locales en ambientes desplegados.
- La CSP se genera durante el Docker Build.
- El nonce cambia en cada respuesta HTML.
- `csp-headers.conf` no debe versionarse.
- Los cambios de seguridad deben probarse primero en Desarrollo.