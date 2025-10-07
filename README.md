# Mémo IA — API + MCP stub

## Démarrage

> ℹ️ Utilisez Node.js LTS (20.x ou 22.x). Avec `nvm`, vous pouvez exécuter `nvm use` (fichier `.nvmrc` fourni) ou `nvm use 22`.

```bash
cp .env.example .env
npm i
npm run dev
# API: http://localhost:8080
# MCP stub: npm run mcp -> http://localhost:9090
```

### Sanity check
```bash
curl -X POST http://localhost:8080/v1/notes \  -H "Authorization: Bearer $APP_BEARER_TOKEN" \  -H "X-ChatGPT-User: user_demo" \  -H 'Content-Type: application/json' \  -d '{"title":"Badge Parking","content":"Q-3 niveau -2","tags":["boulot","parking"],"remind_at":"2025-10-08T09:00:00Z"}'
```
