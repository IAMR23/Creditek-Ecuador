'use strict';

const express = require('express');

const DEFAULT_PORT = 5050;
const LINK_PREFIX = 'SHORTENER_LINK_';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseHttpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function envNameToSlug(name) {
  return name
    .slice(LINK_PREFIX.length)
    .toLowerCase()
    .replaceAll('_', '-');
}

function loadConfiguredLinks(environment = process.env) {
  const links = new Map();

  Object.entries(environment)
    .filter(([name]) => name.startsWith(LINK_PREFIX))
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([name, rawDestination]) => {
      const slug = envNameToSlug(name);
      const destination = parseHttpUrl(rawDestination);

      if (!SLUG_PATTERN.test(slug)) {
        console.warn(`Configuracion ignorada: ${name} no genera un slug valido.`);
        return;
      }

      if (!destination) {
        if (typeof rawDestination === 'string' && rawDestination.trim() !== '') {
          console.warn(`Configuracion ignorada: ${name} no contiene una URL HTTP(S) valida.`);
        }
        return;
      }

      links.set(slug, destination);
    });

  return links;
}

function createApp(links = loadConfiguredLinks()) {
  const app = express();

  app.disable('x-powered-by');

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.get('/:slug', (request, response) => {
    const destination = links.get(request.params.slug.toLowerCase());

    if (!destination) {
      return response.status(404).json({ error: 'Not found' });
    }

    return response.redirect(302, destination);
  });

  app.use((_request, response) => {
    response.status(404).json({ error: 'Not found' });
  });

  app.use((error, _request, response, _next) => {
    console.error('Error interno procesando la solicitud.', error);
    response.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

function resolvePort(value) {
  const port = Number(value ?? DEFAULT_PORT);
  return Number.isInteger(port) && port > 0 && port <= 65535
    ? port
    : DEFAULT_PORT;
}

if (require.main === module) {
  const port = resolvePort(process.env.PORT);
  const app = createApp();

  app.listen(port, '0.0.0.0', () => {
    console.log(`Shortener escuchando en el puerto ${port}.`);
  });
}

module.exports = {
  createApp,
  loadConfiguredLinks,
  parseHttpUrl,
  resolvePort,
};
