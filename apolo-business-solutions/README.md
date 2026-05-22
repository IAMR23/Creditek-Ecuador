# APOLO BUSINESS SOLUTIONS

Proyecto mínimo (backend + frontend) enfocado únicamente en la gestión de usuarios.

## Stack
- Backend: Node.js + Express + Sequelize + PostgreSQL
- Frontend: Vite + React + TailwindCSS
- Docker: `docker-compose.yml` con PostgreSQL + backend + frontend (y Nginx Proxy Manager como en el proyecto original)

## Variables de entorno
- Copia `apolo-business-solutions/.env.example` a `apolo-business-solutions/.env` y ajusta valores.

## Levantar con Docker
Desde `apolo-business-solutions/`:
```bash
docker compose up --build
```

## Bootstrap (primer usuario)
Si la base está vacía, crea el primer usuario admin con:
```bash
curl -X POST http://localhost:5030/bootstrap -H "Content-Type: application/json" -d "{\"nombre\":\"Admin\",\"email\":\"admin@apolo.com\",\"password\":\"Admin123\"}"
```
Luego ingresa en el frontend (http://localhost:8080) con ese email/password.
