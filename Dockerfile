# Campus Köthen – News & Events
# Static website + read-only proxy to the Campus Köthen API, served by unprivileged nginx.
FROM nginxinc/nginx-unprivileged:stable-alpine

ARG APP_VERSION=dev
ARG BUILD_DATE=unknown
ARG VCS_REF=unknown

LABEL org.opencontainers.image.title="campus-app-news-feed-website" \
      org.opencontainers.image.description="Statische Website mit allen News und Events der Campus-Köthen-App" \
      org.opencontainers.image.source="https://github.com/Leviora-Studio/campus-app-news-feed-website" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}"

# Default API origin – override at runtime via API_BASE_URL (see .env.example)
ENV API_BASE_URL=https://campus-koethen-api.sturahsa.de \
    NGINX_ENVSUBST_FILTER=^API_BASE_URL$

# --chmod makes the build independent of the file permissions in the checkout
COPY --chmod=644 nginx/default.conf.template nginx/api-proxy.inc.template /etc/nginx/templates/
COPY --chmod=644 nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --chown=nginx:nginx public/ /usr/share/nginx/html/

USER root
RUN set -eux; \
    apk add --no-cache ca-certificates; \
    find /usr/share/nginx/html -type f \( -name '*.html' -o -name '*.js' \) \
      -exec sed -i "s/__APP_VERSION__/${APP_VERSION}/g" {} +; \
    chmod -R a+rX /usr/share/nginx/html /etc/nginx/templates /etc/nginx/snippets; \
    chown -R nginx:nginx /var/cache/nginx
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
