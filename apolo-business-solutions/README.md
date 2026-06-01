# APOLO BUSINESS SOLUTIONS

Proyecto mínimo (backend + frontend) enfocado en:
- Gestión de usuarios/agencias (relación `UsuarioAgencia`)
- Registro de asistencia por usuario-agencia (pantalla `ControlAsistencia`)

## Stack
- Backend: Node.js + Express + Sequelize + PostgreSQL
- Frontend: Vite + React + TailwindCSS
- Docker: `docker-compose.yml` con PostgreSQL + backend + frontend (y Nginx Proxy Manager como en el proyecto original)

## Variables de entorno
- Copia `apolo-business-solutions/.env.example` a `apolo-business-solutions/.env` y ajusta valores.
- Si no existe `.env`, `docker compose` levantará servicios con variables vacías.

## Levantar con Docker
Desde `apolo-business-solutions/`:
```bash
docker compose up --build
```
Requiere Docker Desktop/Engine en ejecución.

## Bootstrap (primer usuario)
Si la base está vacía, crea el primer usuario admin con:
```bash
curl -X POST http://localhost:5030/bootstrap -H "Content-Type: application/json" -d "{\"nombre\":\"Admin\",\"email\":\"admin@apolo.com\",\"password\":\"Admin123\"}"
```
Luego ingresa en el frontend (http://localhost:8080) con ese email/password.

## Asistencias
El frontend consume estos endpoints (requieren token JWT):
- `GET /asistencias/agencias?mes=YYYY-MM&agenciaId=ID(opcional)`
- `POST /asistencias` body `{ agenciaId, usuarioAgenciaId, fecha: "YYYY-MM-DD", estado }`
  - Usa `estado: "libre"` para eliminar el registro del día.
