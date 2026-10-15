#!/usr/bin/env node

/**
 * generate-csp.mjs
 * -----------------------------------------------------------------------------
 * Genera el fragmento de configuracion NGINX que emite la cabecera
 * Content-Security-Policy.
 *
 * La politica se construye a partir de:
 *
 *   1. style-src
 *      Hash SHA-256 del bloque <style id="csp-critical"> presente en el
 *      index.html compilado.
 *
 *   2. script-src
 *      Nonce diferente por respuesta y origenes concretos de los
 *      microfrontends registrados en federation.manifest.json.
 *
 *   3. connect-src / form-action
 *      Origen de Keycloak recibido mediante un argumento opcional o resuelto
 *      desde el valor predeterminado del arquetipo.
 *
 * FUNCIONAMIENTO DEL NONCE
 *
 * La politica contiene el marcador:
 *
 *   'nonce-$request_id'
 *
 * NGINX expande $request_id al generar la cabecera HTTP y reemplaza el marcador
 * __CSP_NONCE__ dentro del index.html mediante sub_filter.
 *
 * El mismo valor se incorpora en:
 *
 *   - La cabecera Content-Security-Policy.
 *   - El atributo ngCspNonce del elemento raiz de Angular.
 *   - El atributo nonce del bloque esms-options.
 *   - La configuracion interna de es-module-shims.
 *
 * De esta forma, Native Federation puede generar sus import maps dinamicos sin
 * utilizar 'unsafe-inline'.
 *
 * USO
 *
 *   node scripts/generate-csp.mjs \
 *     --index dist/sh-pr-guardian-ai/browser/index.html \
 *     --manifest dist/sh-pr-guardian-ai/browser/federation.manifest.json \
 *     --out /app/csp-headers.conf \
 *     [--auth-origin https://keycloak.ejemplo.com] \
 *     [--mode enforce|report-only] \
 *     [--allow-localhost]
 *
 * MODOS
 *
 *   enforce
 *     Genera Content-Security-Policy. Los recursos no autorizados son
 *     bloqueados por el navegador.
 *
 *   report-only
 *     Genera Content-Security-Policy-Report-Only y agrega
 *     report-uri /csp-report. Las violaciones se reportan sin bloquear.
 *
 * SALIDA
 *
 * Genera un archivo con una unica directiva add_header, diseñado para
 * incluirse dentro del bloque server de nginx/nginx.template.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DEFAULT_AUTH_ORIGIN = 'https://keycloak.apps.ocdv.claro.pe';
const NONCE_PLACEHOLDER = '__CSP_NONCE__';

// @claro/ui genera durante la ejecucion una hoja de estilos global para sus
// Web Components.
//
// El contenido es estable para la version instalada y se autoriza mediante un
// hash especifico, sin utilizar 'unsafe-inline'.
//
// Si se actualiza @claro/ui, este hash debe validarse nuevamente desplegando
// primero la CSP en modo report-only.
const APPROVED_RUNTIME_STYLE_HASHES = [
  "'sha256-MMoXaAKMGvnPp2rZunQD+r4ZH9NTrBbLVIbnmZ4a60Y='"
];

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    mode: 'enforce',
    allowLocalhost: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    if (token === '--allow-localhost') {
      args.allowLocalhost = true;
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];

    args[key] = value;
    index += 1;
  }

  return args;
}

function exitWithError(message) {
  console.error(`[generate-csp] ${message}`);
  process.exit(1);
}

function readJsonFile(filePath, description) {
  let content;

  try {
    content = readFileSync(filePath, 'utf8');
  } catch (error) {
    exitWithError(
      `No se pudo leer ${description}: ${filePath}. ${error.message}`
    );
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    exitWithError(
      `${description} no contiene JSON valido: ${filePath}. ${error.message}`
    );
  }
}

function resolveRemoteOrigins(manifest, allowLocalhost) {
  if (
    manifest === null ||
    typeof manifest !== 'object' ||
    Array.isArray(manifest)
  ) {
    exitWithError(
      'federation.manifest.json debe contener un objeto JSON.'
    );
  }

  const remoteOrigins = [];

  for (const [remoteName, remoteUrl] of Object.entries(manifest)) {
    if (typeof remoteUrl !== 'string' || remoteUrl.trim() === '') {
      exitWithError(
        `URL invalida para el remoto "${remoteName}": "${remoteUrl}".`
      );
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(remoteUrl);
    } catch {
      exitWithError(
        `URL invalida para el remoto "${remoteName}": "${remoteUrl}".`
      );
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      exitWithError(
        `Protocolo no permitido para el remoto "${remoteName}": ` +
          `"${parsedUrl.protocol}".`
      );
    }

    remoteOrigins.push(parsedUrl.origin);
  }

  const uniqueRemoteOrigins = [...new Set(remoteOrigins)];

  const localhostOrigins = uniqueRemoteOrigins.filter((origin) =>
    /^(https?:\/\/)(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(
      origin
    )
  );

  if (localhostOrigins.length > 0 && !allowLocalhost) {
    console.error(
      `[generate-csp] El manifiesto contiene origenes locales: ` +
        `${localhostOrigins.join(', ')}`
    );
    console.error(
      '[generate-csp] Un remoto local no es valido para un despliegue.'
    );
    console.error(
      '[generate-csp] Reemplaza la URL por el endpoint real del ' +
        'microfrontend o elimina la entrada del manifiesto.'
    );
    console.error(
      '[generate-csp] Para desarrollo local, utiliza --allow-localhost.'
    );
    process.exit(1);
  }

  return uniqueRemoteOrigins;
}

function resolveAuthOrigin(authOriginValue) {
  const value = authOriginValue || DEFAULT_AUTH_ORIGIN;

  let parsedUrl;

  try {
    parsedUrl = new URL(value);
  } catch {
    exitWithError(
      `El origen de autenticacion no es una URL valida: "${value}".`
    );
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    exitWithError(
      `Protocolo no permitido para el origen de autenticacion: ` +
        `"${parsedUrl.protocol}".`
    );
  }

  return parsedUrl.origin;
}

function configureEsmsNonce(html) {
  const esmsOptionsPattern =
    /<script\b([^>]*\btype=["']esms-options["'][^>]*)>([\s\S]*?)<\/script>/i;

  const esmsOptionsMatch = html.match(esmsOptionsPattern);

  if (!esmsOptionsMatch) {
    exitWithError(
      'No se encontro el bloque esms-options generado por Native Federation.'
    );
  }

  const esmsAttributes = esmsOptionsMatch[1] ?? '';
  const esmsContent = esmsOptionsMatch[2]?.trim() ?? '';

  let esmsOptions;

  try {
    esmsOptions = esmsContent ? JSON.parse(esmsContent) : {};
  } catch {
    exitWithError(
      `El contenido del bloque esms-options no es JSON valido: ` +
        `"${esmsContent}".`
    );
  }

  esmsOptions.shimMode = true;
  esmsOptions.nonce = NONCE_PLACEHOLDER;

  const attributesWithoutNonce = esmsAttributes
    .replace(/\s+nonce=(["']).*?\1/gi, '')
    .trim();

  const replacement =
    `<script ${attributesWithoutNonce} nonce="${NONCE_PLACEHOLDER}">` +
    `${JSON.stringify(esmsOptions)}` +
    '</script>';

  return html.replace(esmsOptionsPattern, replacement);
}

function calculateCriticalStyleHash(html) {
  const criticalStylePattern =
    /<style id=["']csp-critical["'][^>]*>([\s\S]*?)<\/style>/i;

  const criticalBlock = html.match(criticalStylePattern);

  if (!criticalBlock) {
    console.error(
      '[generate-csp] No se encontro <style id="csp-critical"> ' +
        'en el index.html.'
    );
    console.error(
      '[generate-csp] Sin este bloque, la pantalla de carga previa a Angular ' +
        'quedaria sin estilo.'
    );
    process.exit(1);
  }

  return `'sha256-${createHash('sha256')
    .update(criticalBlock[1], 'utf8')
    .digest('base64')}'`;
}

// ---------------------------------------------------------------------------
// Parseo y validacion de argumentos
// ---------------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2));

const requiredArgs = ['index', 'manifest', 'out'];
const missingArgs = requiredArgs.filter((key) => !args[key]);

if (missingArgs.length > 0) {
  console.error(
    `[generate-csp] Faltan argumentos obligatorios: ` +
      `${missingArgs.map((key) => `--${key}`).join(', ')}`
  );
  console.error(
    '[generate-csp] Uso: node scripts/generate-csp.mjs ' +
      '--index <file> --manifest <file> --out <file> ' +
      '[--auth-origin <url>] [--mode enforce|report-only] ' +
      '[--allow-localhost]'
  );
  process.exit(1);
}

if (!['enforce', 'report-only'].includes(args.mode)) {
  exitWithError(
    `Modo invalido: "${args.mode}". Utiliza "enforce" o "report-only".`
  );
}

// ---------------------------------------------------------------------------
// Preparacion del index.html compilado
// ---------------------------------------------------------------------------

let html;

try {
  html = readFileSync(args.index, 'utf8');
} catch (error) {
  exitWithError(
    `No se pudo leer el index.html compilado: ${args.index}. ` +
      `${error.message}`
  );
}

html = configureEsmsNonce(html);

try {
  writeFileSync(args.index, html);
} catch (error) {
  exitWithError(
    `No se pudo actualizar el index.html compilado: ${args.index}. ` +
      `${error.message}`
  );
}

console.log(
  '[generate-csp] Se configuro el marcador de nonce en esms-options.'
);

// ---------------------------------------------------------------------------
// Fuentes de la politica
// ---------------------------------------------------------------------------

const criticalStyleHash = calculateCriticalStyleHash(html);

const manifest = readJsonFile(
  args.manifest,
  'federation.manifest.json'
);

const remoteOrigins = resolveRemoteOrigins(
  manifest,
  args.allowLocalhost
);

if (remoteOrigins.length === 0) {
  console.warn(
    '[generate-csp] federation.manifest.json esta vacio: ' +
      'ningun remoto quedara permitido en script-src.'
  );
}

const authOrigin = resolveAuthOrigin(args['auth-origin']);

if (!args['auth-origin']) {
  console.warn(
    `[generate-csp] No se proporciono --auth-origin. ` +
      `Se utilizara el valor predeterminado: ${authOrigin}`
  );
}

// ---------------------------------------------------------------------------
// Composicion de la politica
// ---------------------------------------------------------------------------

const scriptSources = [
  "'self'",
  'blob:',
  "'nonce-$request_id'",
  ...remoteOrigins
];

const styleSources = [
  "'self'",
  criticalStyleHash,
  ...APPROVED_RUNTIME_STYLE_HASHES,
  ...remoteOrigins
];

const connectSources = [
  "'self'",
  authOrigin,
  ...remoteOrigins
];

const directives = [
  "default-src 'self'",

  `script-src ${scriptSources.join(' ')}`,

  "script-src-attr 'none'",

  `style-src ${styleSources.join(' ')}`,

  "style-src-attr 'none'",

  "img-src 'self' data: blob:",

  "font-src 'self'",

  `connect-src ${connectSources.join(' ')}`,

  "object-src 'none'",

  "base-uri 'self'",

  "frame-ancestors 'self'",

  `form-action 'self' ${authOrigin}`,

  "worker-src 'self' blob:"
];


const headerName =
  args.mode === 'report-only'
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';

const finalDirectives =
  args.mode === 'report-only'
    ? [...directives, 'report-uri /csp-report']
    : directives;

const csp = finalDirectives.join('; ');

// ---------------------------------------------------------------------------
// Escritura del fragmento NGINX
// ---------------------------------------------------------------------------

const output = [
  '# Generado por scripts/generate-csp.mjs. NO EDITAR A MANO.',
  '# Regenerar mediante el build del Dockerfile.',
  '#',
  `# Modo: ${args.mode}`,
  '# Nonce: generado por NGINX mediante $request_id para cada respuesta.',
  `# Bloque critico index.html: ${criticalStyleHash}`,
  `# Estilos runtime autorizados: ${
    APPROVED_RUNTIME_STYLE_HASHES.join(', ') || '(ninguno)'
  }`,
  `# Remotos permitidos: ${
    remoteOrigins.join(', ') || '(ninguno)'
  }`,
  `# Origen de autenticacion: ${authOrigin}`,
  '',
  `add_header ${headerName} "${csp}" always;`,
  ''
].join('\n');

try {
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, output);
} catch (error) {
  exitWithError(
    `No se pudo escribir el archivo CSP: ${args.out}. ${error.message}`
  );
}

// ---------------------------------------------------------------------------
// Trazabilidad del build
// ---------------------------------------------------------------------------

console.log(`[generate-csp] Escrito ................ ${args.out}`);
console.log(`[generate-csp] Modo ................... ${args.mode}`);
console.log('[generate-csp] Nonce por respuesta ...... nonce-$request_id');
console.log(`[generate-csp] Bloque critico ........... ${criticalStyleHash}`);
console.log(`[generate-csp] script-src ............... ${scriptSources.join(' ')}`);
console.log(`[generate-csp] style-src ................ ${styleSources.join(' ')}`);
console.log(`[generate-csp] connect-src .............. ${connectSources.join(' ')}`);
console.log(`[generate-csp] Estilos runtime .......... ${APPROVED_RUNTIME_STYLE_HASHES.join(' ') || '(ninguno)'}`);
console.log(`[generate-csp] Remotos .................. ${remoteOrigins.join(' ') || '(ninguno)'}`);

if (args.mode === 'report-only') {
  console.log('[generate-csp] Modo report-only: las violaciones NO bloquean. ' + 'Revisar /csp-report antes de cambiar a enforce.');
}