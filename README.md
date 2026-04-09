# Quantum Panel

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-3C873A?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-111111?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Ollama](https://img.shields.io/badge/Ollama-Local%20AI-000000)](https://ollama.com/)

<p align="left">
  <img src="https://skillicons.dev/icons?i=nodejs,express,sqlite,js,html,css,linux,apple,windows" alt="stack icons" />
</p>

Lightweight fullstack server panel with auth, permissions, system stats, team chat, NAS file manager, and a local AI assistant.

## Features

- JWT auth + role/permission management
- Live CPU/RAM/disk/network metrics
- Team chat with Socket.IO
- Local AI section via Ollama (`/api/ai/chat`)
- NAS file list/upload/download/delete with permission checks

## Requirements

- Node.js `20+`
- npm `10+`
- Ollama (for local AI tab)

## Quick Start (All OS)

1. Clone and enter project
```bash
git clone <your-repo-url> quantum-panel
cd quantum-panel
```

2. Install dependencies
```bash
npm install
```

3. Create env file
```bash
cp .env.example .env
```
On Windows PowerShell:
```powershell
Copy-Item .env.example .env
```

4. Edit `.env`
- `JWT_SECRET=...` use a long random value
- `LOCAL_AI_URL=http://127.0.0.1:11434`
- `LOCAL_AI_MODEL=llama3.1:8b`
- `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `NAS_BASE_PATH` (folder used by file manager)

5. Start local AI model (Ollama)

## Install Ollama

### Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### macOS
```bash
brew install --cask ollama
```

### Windows
- Install from: `https://ollama.com/download/windows`

Then run model setup (all OS):
```bash
ollama serve
ollama pull llama3.1:8b
```

## Run App

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

Open:
- `http://127.0.0.1:3000`
- LAN access: `http://<YOUR_LAN_IP>:3000`

## NAS Folder Setup

### Linux/macOS
```bash
mkdir -p /srv/quantum-nas
```

### Windows PowerShell
```powershell
New-Item -ItemType Directory -Path "C:\\quantum-nas" -Force
```

Set in `.env`:
- Linux/macOS: `NAS_BASE_PATH=/srv/quantum-nas`
- Windows: `NAS_BASE_PATH=C:\\quantum-nas`

## Optional: HTTPS Reverse Proxy (Linux Nginx)

Use this only if you want LAN HTTPS with self-signed cert:

```bash
sudo apt install -y nginx
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/quantum.key \
  -out /etc/nginx/ssl/quantum.crt
```

Minimal Nginx site:
```nginx
server {
    listen 80;
    server_name <YOUR_LAN_IP_OR_DOMAIN>;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name <YOUR_LAN_IP_OR_DOMAIN>;

    ssl_certificate /etc/nginx/ssl/quantum.crt;
    ssl_certificate_key /etc/nginx/ssl/quantum.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Default Behavior

- Public registration is off by default (`ALLOW_PUBLIC_REGISTER=false`)
- Admin can create users from Users tab
- Upload/download/delete permissions are enforced per user

## Notes for Template Publishing

Keep these private locally:
- `.env`
- `.env.*` (except `.env.example`)
- local DB files
- personal notes/folders
