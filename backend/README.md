# Neon Stream Backend

Simple Node backend for Neon Stream. Provides persistent playlists and ratings using a JSON file store.

Run locally:

```bash
# from backend folder
npm install
npm start
```

Endpoints:
- `GET /api/playlists` — list playlists
- `POST /api/playlists` — create playlist { name, trackPaths }
- `GET /api/playlists/:id` — get playlist
- `PUT /api/playlists/:id` — update playlist
- `DELETE /api/playlists/:id` — delete playlist
- `GET /api/ratings` — list ratings
- `GET /api/ratings/:path` — get rating for encoded path
- `PUT /api/ratings/:path` — set rating { rating }
- `POST /api/import` — import data
- `GET /api/export` — export data

Quick test with curl:

```bash
# list playlists
curl http://localhost:3000/api/playlists

# create playlist
curl -X POST -H "Content-Type: application/json" -d '{"name":"My Mix","trackPaths":["/music/song1.mp3"]}' http://localhost:3000/api/playlists
```

Docker (no host Node required):

```bash
# build and run with docker-compose
docker compose up --build

# or using docker directly
cd backend && docker build -t neon-backend .
docker run -p 3000:3000 -v "$(pwd)":/app neon-backend
```

Note: using Docker mounts the repo into the container so changes to `server.js` are reflected immediately.
