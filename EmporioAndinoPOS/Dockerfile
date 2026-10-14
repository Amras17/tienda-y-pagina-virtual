# EmporioAndinoPOS 3.3 · servidor para Google Cloud Run (con Cloud SQL para PostgreSQL)
# Se construye desde esta carpeta:  gcloud run deploy emporio --source .
# Imagen oficial de Node.js desde el espejo de Google (evita el límite de descargas de Docker Hub)
FROM mirror.gcr.io/library/node:22-slim
WORKDIR /app
ENV NODE_ENV=production EAPOS_RAIZ=/app ZONA=America/Santiago
COPY servidor/package.json servidor/package-lock.json servidor/
RUN cd servidor && npm ci --omit=dev && npm cache clean --force
COPY . .
USER node
EXPOSE 8080
CMD ["node", "servidor/servidor.js"]
