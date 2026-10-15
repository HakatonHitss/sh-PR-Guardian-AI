#!/usr/bin/env node
/**
 * write-federation-manifest.mjs
 * -----------------------------------------------------------------------------
 * Reescribe federation.manifest.json en dist/ con la URL del remoto del entorno
 * destino, antes de que se genere la CSP.
 *
 * POR QUE ESTE SCRIPT EXISTE
 * src/public/federation.manifest.json se copia tal cual a dist/ en TODOS los
 * entornos: angular.json solo define fileReplacements para environment.ts. Eso
 * significa que un build de produccion conserva http://localhost:4211, y que:
 *   - el shell intenta cargar el microfrontend desde el localhost del navegador;
 *   - la CSP derivada de ese manifiesto abriria script-src a un origen local.
 *
 * Ademas, resolver el manifiesto antes de generar la CSP es lo que garantiza que
 * ambos artefactos describan el mismo conjunto de remotos.
 *
 * USO
 *   node scripts/write-federation-manifest.mjs \
 *     --manifest dist/sh-pr-guardian-ai/browser/federation.manifest.json \
 *     --remote template=http://localhost:4211/remoteEntry.json
 *
 *   El argumento --remote es REPETIBLE y acepta varios pares nombre=url, de modo
 *   que añadir un microfrontend no requiere tocar codigo.
 *
 * VALORES POR DEFECTO
 *   Si no se pasa ningun --remote se conserva el manifiesto existente y solo se
 *   valida. Esto mantiene util el `npm run build` en desarrollo sin argumentos.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function parseArgs(argv) {
  const args = { remotes: [] };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--manifest') {
      args.manifest = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--remote') {
      args.remotes.push(argv[i + 1]);
      i += 1;
    }
  }

  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.remotes.length === 0 && process.env.REMOTE_TEMPLATE_URL) {
  args.remotes.push(`template=${process.env.REMOTE_TEMPLATE_URL}`);
}

if (!args.manifest) {
  console.error('[write-federation-manifest] Falta --manifest <ruta del federation.manifest.json en dist/>');
  process.exit(1);
}

if (!existsSync(args.manifest)) {
  console.error(`[write-federation-manifest] No existe el manifiesto: ${args.manifest}`);
  console.error('[write-federation-manifest] Revisa que el build haya copiado src/public/ a dist/.');
  process.exit(1);
}

// Parseo de los pares nombre=url y validacion temprana de cada URL: un manifiesto
// invalido aqui se traduce en un index.html que nunca termina de cargar.
const overrides = {};

for (const pair of args.remotes) {
  const separatorIndex = pair.indexOf('=');

  if (separatorIndex <= 0) {
    console.error(`[write-federation-manifest] Formato invalido: "${pair}". Se espera nombre=url, por ejemplo template=https://host/remoteEntry.json`);
    process.exit(1);
  }

  const name = pair.slice(0, separatorIndex);
  const url = pair.slice(separatorIndex + 1);

  try {
    // Normalizar a URL absoluta: es lo que espera federation-manifest.ts, que
    // resuelve la base con new URL(remoteEntry, document.baseURI).
    overrides[name] = new URL(url).toString();
  } catch {
    console.error(`[write-federation-manifest] URL invalida para "${name}": "${url}"`);
    process.exit(1);
  }
}

const manifest = JSON.parse(readFileSync(args.manifest, 'utf8'));
const before = JSON.stringify(manifest);
Object.assign(manifest, overrides);
const after = JSON.stringify(manifest, null, 2);

if (before !== JSON.stringify(manifest, null, 2)) {
  writeFileSync(args.manifest, after);
  console.log(`[write-federation-manifest] Actualizado ${args.manifest}`);
} else {
  console.log(`[write-federation-manifest] Sin cambios en ${args.manifest}`);
}

for (const [name, url] of Object.entries(manifest)) {
  console.log(`[write-federation-manifest]   ${name} -> ${url}`);
}

if (Object.keys(overrides).length === 0) {
  console.log('[write-federation-manifest] No se proporcionaron overrides de remotos; ' + 'se conservara el manifiesto del repositorio.');

  if (Object.keys(manifest).length === 0) {
    console.log('[write-federation-manifest] El manifiesto esta vacio. ' + 'El Shell se desplegara sin microfrontends remotos registrados.');
  }
}
