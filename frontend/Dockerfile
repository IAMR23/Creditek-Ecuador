# 1. Build de Vite
FROM node:22 AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# 2. Servir con NGINX (producción)
FROM nginx:alpine

# Copia la build generada por Vite a Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx sirve en el puerto 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
