FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node index.js ./

USER node

EXPOSE 5050

CMD ["node", "index.js"]
