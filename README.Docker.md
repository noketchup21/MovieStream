# MovieStream Docker Setup

This guide explains how to run MovieStream using Docker and Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10 or later)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0 or later)

## Quick Start

### 1. Configure Environment Variables

Copy the example environment file and configure your settings:

```bash
cp .env.docker .env
```

Edit `.env` and set your values:
- MongoDB credentials
- JWT secret keys (IMPORTANT: Change in production!)
- Email configuration (for password reset & verification)
- Gemini API key (for AI-powered movie ranking)

### 2. Start All Services

```bash
docker-compose up -d
```

This will start:
- **MongoDB** (port 27017)
- **Go Backend API** (port 8080)
- **React Frontend** (port 3000)

### 3. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8080
- **Swagger Docs:** http://localhost:8080/swagger/index.html

## Docker Commands

### Start services
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

### Rebuild after code changes
```bash
# Rebuild all
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend
docker-compose up -d --build frontend
```

### Access service shell
```bash
# Backend
docker exec -it moviestream-backend sh

# MongoDB
docker exec -it moviestream-mongodb mongosh
```

### Stop and remove everything (including volumes)
```bash
docker-compose down -v
```

## Service Details

### MongoDB
- **Port:** 27017
- **Data persistence:** `mongodb_data` volume
- **Credentials:** Set via environment variables

### Backend (Go)
- **Port:** 8080
- **Health check:** http://localhost:8080/health (if implemented)
- **Swagger docs:** http://localhost:8080/swagger/index.html

### Frontend (React + Nginx)
- **Port:** 3000 (mapped to container's port 80)
- **Production build** served by Nginx
- **SPA routing** configured

## Production Deployment

### Security Checklist

1. ✅ Change all default passwords and secrets in `.env`
2. ✅ Use strong JWT secret keys (at least 32 characters)
3. ✅ Set proper email credentials for Gmail/SMTP
4. ✅ Configure Gemini API key
5. ✅ Use HTTPS (add reverse proxy like Traefik or nginx)
6. ✅ Enable MongoDB authentication in production
7. ✅ Set proper CORS origins in backend
8. ✅ Regular backups of MongoDB data

### Production docker-compose.yml adjustments

For production, consider:
- Using secrets management (Docker Secrets or Kubernetes Secrets)
- Adding health checks
- Setting resource limits
- Using production-grade reverse proxy (Traefik, nginx)
- Enabling SSL/TLS certificates (Let's Encrypt)

### Example with Traefik reverse proxy

```yaml
# Add to docker-compose.yml
services:
  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=your-email@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./letsencrypt:/letsencrypt
```

## Troubleshooting

### Backend can't connect to MongoDB
- Ensure MongoDB is running: `docker-compose ps`
- Check MongoDB logs: `docker-compose logs mongodb`
- Verify credentials in `.env` match MongoDB configuration

### Frontend can't reach backend
- Check backend is running: `docker-compose ps`
- Verify API URL in frontend `.env` or configuration
- Check CORS settings in backend

### Port already in use
If ports 3000, 8080, or 27017 are already in use, edit `docker-compose.yml`:
```yaml
ports:
  - "3001:80"  # Frontend on different port
  - "8081:8080"  # Backend on different port
```

### Rebuild issues
Clean rebuild:
```bash
docker-compose down
docker system prune -a
docker-compose up -d --build
```

## Development vs Production

### Development
- Use `docker-compose.yml` as-is
- Mount source code for hot reload (optional)
- Expose all ports for debugging

### Production
- Change all secrets and passwords
- Use environment-specific `.env` files
- Add reverse proxy with SSL
- Implement proper logging and monitoring
- Set up regular backups
- Use Docker secrets or external secret management

## Backup MongoDB Data

### Backup
```bash
docker exec moviestream-mongodb mongodump --out /data/backup
docker cp moviestream-mongodb:/data/backup ./mongodb-backup
```

### Restore
```bash
docker cp ./mongodb-backup moviestream-mongodb:/data/restore
docker exec moviestream-mongodb mongorestore /data/restore
```

## Support

For issues or questions, please refer to the main README.md or open an issue on GitHub.
