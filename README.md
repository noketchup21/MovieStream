# 🎬 MovieStream

MovieStream is a full-stack web application that recommends movies based on your favorite genres using AI. This is a fun personal project focused on learning Go, Gin, MongoDB, Docker, and modern frontend development with React + Vite.

## 🚀 Features

- AI-powered movie recommendations (Gemini API)
- User authentication (JWT, refresh tokens)
- Email verification & password reset
- Genre-based personalized ranking
- Swagger API documentation
- Fully Dockerized (Backend, Frontend, MongoDB)
- Production-ready deployment setup

## 🏗️ Tech Stack

### Backend

- Go
- Gin Framework
- MongoDB
- JWT Authentication
- Swagger (OpenAPI)

### Frontend

- React
- Vite
- Axios
- React Router
- Nginx (production build)

### DevOps / Infrastructure

- Docker & Docker Compose
- AWS Lambda (Email Sender)
- Gmail SMTP
- Optional Traefik Reverse Proxy

## 🐳 Docker Setup

This guide explains how to run MovieStream using Docker and Docker Compose.

### Prerequisites

- Docker v20.10+
- Docker Compose v2.0+

### ⚡ Quick Start

#### 1️⃣ Configure Environment Variables
```bash
cp .env.docker .env
```

Edit `.env` and configure:

- MongoDB credentials
- JWT secrets (change in production)
- Email configuration
- Gemini API key

#### 2️⃣ Start All Services
```bash
docker-compose up -d
```

This will start:

| Service | Port |
|---------|------|
| MongoDB | 27017 |
| Go Backend API | 8080 |
| React Frontend | 3000 |

#### 3️⃣ Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- Swagger Docs: http://localhost:8080/swagger/index.html

## 📦 Docker Commands

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
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

### Rebuild after code changes
```bash
docker-compose up -d --build
docker-compose up -d --build backend
docker-compose up -d --build frontend
```

### Access container shells
```bash
docker exec -it moviestream-backend sh
docker exec -it moviestream-mongodb mongosh
```

### Remove everything (including volumes)
```bash
docker-compose down -v
```

## 🧩 Service Details

### MongoDB

- Port: 27017
- Persistent volume: `mongodb_data`
- Credentials set via `.env`

### Backend (Go + Gin)

- Port: 8080
- Health check: `/health` (if implemented)
- Swagger: `/swagger/index.html`

### Frontend (React + Vite + Nginx)

- Port: 3000
- Production build served by Nginx
- SPA routing configured

## ⚛️ React + Vite Frontend

### Tech Overview

- React 19.2
- Vite for fast development & builds
- Axios for API requests
- React Router for SPA routing
- Environment-based configuration

### Development Mode (Optional)

Run frontend separately:
```bash
cd MovieStream\Client\movie-stream-client
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

Make sure the backend API URL is correctly set in:
```env
VITE_API_URL=http://localhost:8080
```

### Production Mode

- Built using `vite build`
- Served via Nginx inside Docker
- Optimized static assets
- SPA fallback configured

## 🏭 Production Deployment

### Security Checklist

- ✅ Change all default passwords
- ✅ Use strong JWT secrets (32+ chars)
- ✅ Configure email credentials
- ✅ Set Gemini API key
- ✅ Enable HTTPS
- ✅ Restrict CORS origins
- ✅ Enable MongoDB authentication
- ✅ Regular database backups

### Recommended Production Improvements

- Docker Secrets or external secret manager
- Health checks
- Resource limits
- Reverse proxy (Traefik / Nginx)
- SSL via Let's Encrypt
- Centralized logging & monitoring

## 🔐 Traefik Reverse Proxy (Example)
```yaml
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

## 🛠️ Troubleshooting

### Backend can't connect to MongoDB
```bash
docker-compose ps
docker-compose logs mongodb
```

Verify credentials in `.env`

### Frontend can't reach backend

- Check backend container status
- Verify `VITE_API_URL`
- Check CORS configuration

### Port already in use

Change ports in `docker-compose.yml`:
```yaml
ports:
  - "3001:80"
  - "8081:8080"
```

### Clean rebuild
```bash
docker-compose down
docker system prune -a
docker-compose up -d --build
```

## 💾 MongoDB Backup & Restore

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

## ✉️ Lambda Email Sender (AWS)

AWS Lambda function for sending verification & reset emails via Gmail SMTP.

### Purpose

Acts as a secure middleman between:

- Render-deployed backend
- Gmail SMTP

### Setup Summary

1. Install dependencies
2. Zip code
3. Create Lambda (Node.js 20)
4. Upload zip
5. Configure environment variables
6. Create Function URL or API Gateway
7. Connect backend via `.env`
8. Increase timeout (30s)

### Lambda Environment Variables

| Key | Value |
|-----|-------|
| SMTP_HOST | smtp.gmail.com |
| SMTP_PORT | 465 |
| SMTP_USER | your_gmail@gmail.com |
| SMTP_PASS | Gmail app password |
| SMTP_FROM_EMAIL | your_gmail@gmail.com |
| SMTP_FROM_NAME | MovieStream |
| LAMBDA_API_KEY | secure_random_key |

### Backend .env
```env
LAMBDA_EMAIL_URL=https://your-lambda-url
LAMBDA_API_KEY=your_secure_random_api_key
```

### Test Payload
```json
{
  "to_email": "test@example.com",
  "username": "TestUser",
  "code": "123456",
  "api_key": "your_lambda_api_key"
}
```

## 📬 Support

For issues or questions:

- Check logs
- Read Swagger docs
- Open an issue on GitHub
