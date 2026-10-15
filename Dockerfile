# =============================================================================
# Stage 1: Build de Angular y generación de CSP
# =============================================================================
FROM node:20-bookworm-slim AS builder

USER root

ARG ENV=production
ARG REMOTE_TEMPLATE_URL

WORKDIR /app

# Copiar archivos de dependencias.
COPY package*.json ./

# Instalar dependencias.
RUN npm install --no-audit

# Copiar el código fuente.
COPY . .

# Compilar Angular, validar el manifiesto de Federation y generar la CSP.
#
# El arquetipo puede desplegarse sin microfrontends registrados, por lo que
# federation.manifest.json puede permanecer vacío.
#
# generate-csp.mjs:
# - configura el nonce para Angular y es-module-shims;
# - calcula los hashes de estilos autorizados;
# - restringe los orígenes de los remotos registrados;
# - genera la política CSP definitiva en modo enforce.
RUN echo "Building for environment: ${ENV}" && \
    npm run build -- --configuration="${ENV}" && \
    if [ -n "${REMOTE_TEMPLATE_URL}" ]; then \
        node scripts/write-federation-manifest.mjs \
            --manifest dist/sh-pr-guardian-ai/browser/federation.manifest.json \
            --remote "template=${REMOTE_TEMPLATE_URL}"; \
    else \
        node scripts/write-federation-manifest.mjs \
            --manifest dist/sh-pr-guardian-ai/browser/federation.manifest.json; \
    fi && \
    if [ "${ENV}" = "production" ] && grep -q 'localhost' dist/sh-pr-guardian-ai/browser/federation.manifest.json; then \
        echo "REMOTE_TEMPLATE_URL es obligatorio para una imagen de produccion que incluya remotos."; \
        exit 1; \
    fi && \
    node scripts/generate-csp.mjs \
        --index dist/sh-pr-guardian-ai/browser/index.html \
        --manifest dist/sh-pr-guardian-ai/browser/federation.manifest.json \
        --out /app/csp-headers.conf \
        --mode enforce && \
    echo "--- federation.manifest.json ---" && \
    cat dist/sh-pr-guardian-ai/browser/federation.manifest.json && \
    echo "--- csp-headers.conf ---" && \
    cat /app/csp-headers.conf


# =============================================================================
# Stage 2: Ejecución con NGINX
# =============================================================================
FROM nginxinc/nginx-unprivileged:1.27-alpine

USER root

ARG ENV=production
ARG BUILD_VERSION=latest

# La solución CSP depende de sub_filter para reemplazar __CSP_NONCE__
# por un valor diferente en cada respuesta HTML.
RUN if nginx -V 2>&1 | grep -q -- '--with-http_sub_module'; then \
        echo "[CSP] ngx_http_sub_module disponible"; \
    else \
        echo "[CSP] ERROR: ngx_http_sub_module no disponible"; \
        exit 1; \
    fi

# Copiar configuraciones de NGINX.
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/nginx.template /etc/nginx/templates/default.conf.template
COPY nginx/docker-entrypoint.sh /docker-entrypoint.sh

# Copiar la aplicación compilada y la CSP generada.
COPY --from=builder \
    /app/dist/sh-pr-guardian-ai/browser/ \
    /usr/share/nginx/html/

COPY --from=builder \
    /app/csp-headers.conf \
    /etc/nginx/csp-headers.conf

# Crear los directorios requeridos por NGINX.
RUN mkdir -p \
        /var/cache/nginx \
        /var/run \
        /var/log/nginx \
        /etc/nginx/conf.d \
        /etc/nginx/templates

# Adecuar permisos para la ejecución como usuario no-root en OpenShift.
RUN chgrp -R 0 \
        /usr/share/nginx \
        /var/cache/nginx \
        /var/run \
        /var/log/nginx \
        /etc/nginx && \
    chmod -R g=u \
        /usr/share/nginx \
        /var/cache/nginx \
        /var/run \
        /var/log/nginx \
        /etc/nginx && \
    chmod +x /docker-entrypoint.sh

ENV ENV=${ENV}

LABEL environment="${ENV}" \
      version="${BUILD_VERSION}"

USER 101

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]