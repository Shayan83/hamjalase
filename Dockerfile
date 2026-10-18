FROM node:24-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    WRANGLER_SEND_METRICS=false \
    CLOUDFLARE_CF_FETCH_ENABLED=false
COPY package.json package-lock.json .npmrc ./
RUN npm ci --include=dev --include=optional --no-audit --no-fund
# Reuse Node's maintained public roots for workerd in the slim Linux image.
# This supplies trusted CAs; it does not disable TLS verification.
RUN node -e "require('fs').writeFileSync('/usr/local/share/node-public-roots.pem', require('tls').rootCertificates.join('\n'))"
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/node-public-roots.pem
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
