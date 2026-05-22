FROM node:22

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5030
CMD ["node", "index.js"]

