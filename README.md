# Mémo IA — API + MCP

## Démarrage

> ℹ️ Utilisez Node.js LTS (20.x ou 22.x). Avec `nvm`, vous pouvez exécuter `nvm use` (fichier `.nvmrc` fourni) ou `nvm use 22`.

```bash
cp .env.example .env
echo "APP_BEARER_TOKEN=$(openssl rand -hex 24)" >> .env
npm i
npm run dev
# API: http://localhost:8080
# MCP server: npm run mcp (voir section dédiée)
```

### Sanity check
```bash
curl -X POST http://localhost:8080/v1/notes \  -H "Authorization: Bearer $APP_BEARER_TOKEN" \  -H "X-ChatGPT-User: user_demo" \  -H 'Content-Type: application/json' \  -d '{"title":"Badge Parking","content":"Q-3 niveau -2","tags":["boulot","parking"],"remind_at":"2025-10-08T09:00:00Z"}'
```

## Déploiement

- Configurez les variables d'environnement : `PORT`, `HOST=0.0.0.0`, `APP_BEARER_TOKEN`, `DATABASE_URL=./data/memo.db`, `MCP_HOST`, `MCP_PORT`.
- Assurez-vous que le répertoire de la base existe (géré automatiquement par l'app).
- Sur Railway, exposez `openapi.yaml` et `src/app.json` (manifeste Apps SDK) à ChatGPT une fois le domaine public disponible.

## MCP (Model Context Protocol)

```bash
npm run build
MCP_PORT=9090 MCP_HOST=0.0.0.0 npm run mcp
```

- Le serveur MCP expose les outils `create_note`, `list_notes`, `get_note`, `update_note`, `delete_note`, `export_notes`, `purge_notes`.
- Dans ChatGPT → Settings → Connectors → Add new MCP connector : choisissez « Aucune authentification », pointez vers `wss://<votre-domaine>:<MCP_PORT>` (ou l’URL HTTPS tunnelisée) et fournissez à l’assistant le contexte `user_id` (via `{{user_id}}`) pour que chaque appel envoie le bon identifiant.
- Pour un usage local, `npm run mcp` écoute par défaut sur `0.0.0.0:9090`. Utilisez un tunnel (Cloudflared/Ngrok) pour exposer le port si besoin.
