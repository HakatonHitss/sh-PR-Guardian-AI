# PR Guardian AI Shell

Shell Angular 20 con Native Federation para PR Guardian AI. Carga el microfrontend remoto `template` y conserva la interfaz de revision de pull requests.

## Requisitos

- Node.js 20 LTS o superior.
- npm con acceso a `https://registry.npmjs.org/`.

## Desarrollo local

```bash
npm install
npm run dev
```

La URL local por defecto es `http://localhost:4201`. Para ejecutar el microfrontend asociado, inicia tambien `mf-PR-Guardian-AI` en su puerto de desarrollo.

## Build

```bash
npm run build
```

El resultado estatico se genera en `dist/sh-pr-guardian-ai/browser`.

La shell lee `REMOTE_TEMPLATE_URL` durante el build. Define una URL HTTPS publica cuando el microfrontend se publique en otro host:

```bash
REMOTE_TEMPLATE_URL=https://tu-microfrontend.vercel.app/remoteEntry.json npm run build
```

El manifiesto final y la Content Security Policy se generan con esa misma URL. Los builds de produccion rechazan remotos `localhost`.

## Despliegue en Vercel

1. Crea un proyecto Vercel con `mf-PR-Guardian-AI` como Root Directory y despliegalo primero.
2. Copia la URL de `remoteEntry.json` del proyecto publicado.
3. Crea otro proyecto Vercel con `sh-PR-Guardian-AI` como Root Directory.
4. En sus variables de entorno de Build, agrega `REMOTE_TEMPLATE_URL` con la URL copiada.
5. Despliega la shell.

La autenticacion actual es local para demostracion. Antes de habilitar usuarios reales, integra un proveedor OIDC publico y valida tokens del lado servidor.