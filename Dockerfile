# ETAPA 1: Construcción (Builder) - Multi-stage build
FROM node:22-alpine AS builder
WORKDIR /app
# Copiamos solo los archivos de dependencias primero 
COPY package*.json ./
# Instalamos todas las dependencias
RUN npm install

# ETAPA 2: Producción (Imagen final minimizada)
FROM node:22-alpine
WORKDIR /app

# VULNERABILITY MITIGATION: No usar el usuario root
# Alpine trae un usuario llamado 'node' por defecto con menos privilegios
RUN chown -R node:node /app
USER node

# Copiamos dependencias desde el builder (minimiza tamaño)
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
# Copiamos el código fuente de la aplicación
COPY --chown=node:node . .

# Exponemos el puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "app.js"]