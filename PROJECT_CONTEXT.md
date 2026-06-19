# PROJECT CONTEXT — La Buena Familia · LoL Tracker
> Última actualización: 2026-06-17

---

## Descripción general

PWA de seguimiento de estadísticas de League of Legends para un grupo de amigos ("la familia"). Permite ver rankings, registrar baneos con cuenta regresiva, subir capturas de partidas, y detectar si alguien está jugando en tiempo real. Todo gratis, sin servidor propio.

---

## Arquitectura y hosting

| Capa | Servicio | Plan | Notas |
|------|----------|------|-------|
| Frontend (estático) | GitHub Pages | Gratis | Single-file PWA — `index.html` + `manifest.json` + `sw.js` + iconos |
| Auth + Base de datos | Firebase (Spark) | Gratis | Email/password Auth + Firestore (tiempo real) |
| Almacenamiento de imágenes | Cloudinary | Gratis, sin tarjeta | Upload preset sin firmar |
| Proxy Riot API | Cloudflare Worker | Gratis (100k req/día) | Mantiene la API key server-side |
| CI/CD del Worker | GitHub Actions | Gratis | Deploy automático del Worker en cada push a `main` (`wrangler-action@v3`) |
| CDN de assets LoL | Data Dragon (Riot CDN) | Público | Iconos de campeones, perfiles, versiones |

**Sin build step.** Todo es HTML + CSS + JS vanilla en un único archivo.

---

## Archivos del proyecto

```
lol-stats-tracker/
├── index.html              ← App completa (~1500+ líneas)
├── riot-proxy-worker.js    ← Cloudflare Worker (v2) — deploy automático vía GitHub Actions
├── wrangler.toml           ← Config del deploy del Worker (name + main)
├── .github/workflows/
│   └── deploy-worker.yml    ← CI: despliega el Worker en push a main
├── firestore.rules         ← Reglas de seguridad de Firestore
├── manifest.json           ← PWA manifest
├── sw.js                   ← Service Worker (offline shell)
├── icon-192.png            ← Ícono PWA
└── icon-512.png            ← Ícono PWA grande
```

> `riot-proxy-worker.js` se commitea al repo. El deploy al Worker de Cloudflare es automático vía GitHub Actions (`.github/workflows/deploy-worker.yml`) cuando se pushea a `main`.

### Ubicación del repo y documentación

- El repo vive **dentro de la bóveda de Obsidian**: `E:\Obsidian\Mi Base de Conocimiento\02 - Proyectos\La Buena Familia\lol-stats-tracker\`. Se edita en Obsidian y se pushea a GitHub desde la misma carpeta. (Antes estaba en `C:\...\OneDrive\...\Code`.)
- **Backup = GitHub** (ya no OneDrive).
- **Fuente de verdad única** de la doc: `CHANGELOG_AI.md` y `PROJECT_CONTEXT.md` viven en el repo. Las notas `La Buena Familia — Changelog AI.md` y `La Buena Familia — Project Context.md` de Obsidian son **punteros** que enlazan a estas (para no romper backlinks existentes).
- `storage.rules` fue eliminado: las capturas van por Cloudinary, no Firebase Storage.

---

## Configuración (hardcodeada en index.html)

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBC7LU_VrkjTnKTDhKPH2wvF142gDbM5nc",
  authDomain: "la-buena-familia.firebaseapp.com",
  projectId: "la-buena-familia",
  storageBucket: "la-buena-familia.firebasestorage.app",
  messagingSenderId: "616676907236",
  appId: "1:616676907236:web:cfbc92f21e73c58b60f4f1"
};
const RIOT_PROXY_URL = "https://la-buena-familia.nimoirano.workers.dev";
const REGION = "las";
const CLOUDINARY_CLOUD_NAME = "dmtmthzje";
const CLOUDINARY_UPLOAD_PRESET = "tcdrw58f";
```

---

## Colecciones de Firestore

### `players/{id}`
```
gameName        string     Nombre del invocador (Riot)
tagLine         string     Tag sin # (ej: LAS1)
displayName     string     Apodo en la familia (opcional)
region          string     "las"
addedBy         string     UID del usuario que lo agregó
addedByName     string     Nombre para mostrar del que lo agregó
createdAt       Timestamp
cachedStats     object     Ver estructura abajo
lpHistory       array      Últimos 30 puntos de LP (para sparkline)
```

**cachedStats** (retornado por el Worker `/profile`):
```
gameName, tagLine, puuid
profileIconId   number
summonerLevel   number
rank            { tier, division, lp, wins, losses }   ← Solo/Duo
flexRank        { tier, division, lp, wins, losses }   ← Flex (puede ser null)
kda             string   KDA promedio de últimas 10 partidas
topChamps       [{ name, games }]   Top 4 campeones
matches         [{ champion, win, kills, deaths, assists, kdaRatio, cs, csPerMin,
                   damage, visionScore, duration, queueId, queue, ago }]
cachedAt        number   timestamp ms
```

### `bans/{id}`
```
playerId        string     ID del jugador en Firestore
playerName      string     Copia del nombre (para mostrar si se elimina el jugador)
type            string     "game" | "chat"
startAt         number     Timestamp ms del inicio del baneo
durationHours   number     72 (game) | 168 (chat)
note            string     Razón del baneo (opcional)
createdBy       string     UID
createdByName   string
createdAt       Timestamp
reactions       object     { "🤡": [uid1, uid2], "😤": [...], ... }
```

### `screenshots/{id}`
```
url             string     URL de Cloudinary (HTTPS)
publicId        string     ID de Cloudinary (para futuras operaciones)
caption         string     Título ingresado al subir
uploadedBy      string     UID
uploadedByName  string
createdAt       Timestamp
```

### `comments/{id}`
```
screenshotId    string     ID del screenshot en Firestore
text            string     Contenido del comentario (max 200 chars)
authorId        string     UID
authorName      string
createdAt       Timestamp
```

> Los comentarios requieren un **índice compuesto** en Firestore:
> `screenshotId ASC` + `createdAt ASC`

---

## Cloudflare Worker — endpoints

### `GET /profile?gameName=X&tagLine=Y&region=las`
Retorna stats completas del jugador: cuenta, rango Solo, rango Flex, KDA, top campeones, últimas 10 partidas (con CS, CS/min, daño, vision score, duración).

### `GET /live?puuid=X&region=las`
Retorna si el invocador está en partida actualmente.
- Si está: `{ inGame: true, queueId, queue, duration, gameMode, participants[], bans[] }`
  - `bans`: `[{ championId, teamId, pickTurn }]` — bans del draft (de `bannedChampions`, sin costo extra).
- Si no está: `{ inGame: false }`
- Cada `participant`: `{ teamId, puuid, riotId, championId, profileIconId, spell1Id, spell2Id }`

**Variable de entorno requerida en Cloudflare:** `RIOT_API_KEY`

---

## Tabs de la app

| Tab | Sección | Contenido |
|-----|---------|-----------|
| Familiares | `players` | Cards con stats, racha de forma, badge "En partida", búsqueda |
| Ranking | `ranking` | Leaderboard, premios automáticos, ranking de vergüenza, comparador |
| Baneos | `bans` | Timeline Gantt, countdown activo, baneos finalizados con reacciones emoji |
| Capturas | `shots` | Galería grid, lightbox con comentarios |
| Ajustes | `me` | Info de cuenta, estado de conexiones, logout |

---

## Funcionalidades implementadas

### Familiares (tab Players)
- Agregar / editar / eliminar familiares (Riot ID = gameName + tagLine)
- Actualizar stats desde Riot vía Worker (botón individual o "Actualizar todos")
- Ícono de perfil de Data Dragon
- Rango Solo con LP
- Winrate, W-L, KDA en la card
- Racha de forma: últimas 5 partidas (V/D)
- Badge "En partida 🟢" con tipo de cola y duración (polling cada 2 min)
- Buscador/filtro en tiempo real
- Flag de baneo activo con tiempo restante

### Detalle de jugador (modal)
- Enlace a op.gg
- Toggle Solo/Duo vs Flex
- Sparkline SVG de progresión de LP (hasta 20 puntos)
- Top 4 campeones jugados
- Últimas 10 partidas con: campeón, icono, resultado, K/D/A, KDA ratio, cola, duración, CS, CS/min, daño, vision score, tiempo transcurrido
- Botones editar / eliminar

### Baneos
- Tipos: **Juego** (3 días / 72h) y **Versión Demo** (7 días / 168h)
- Countdown en vivo (días / horas / min / seg), tick cada segundo
- Timeline Gantt con scroll horizontal, línea "HOY", agrupado por jugador
- Reacciones emoji en cada baneo: 🤡 😤 💀 😂 🎮 🫡 (toggle, muestra count)
- Historial de baneos finalizados

### Ranking
- Leaderboard ordenado por tier/division/LP con medallas 🥇🥈🥉
- Premios automáticos (2+ jugadores con stats):
  - 🏋️ El más tryhard (más partidas)
  - ⚔️ Mejor KDA
  - 💀 Feeder oficial (peor KDA)
  - 📈 Mayor winrate (mín. 10 partidas)
  - 🪶 Mejor poeta (más baneado)
- Ranking de vergüenza 🤡 (por días totales baneado)
- Comparador: 2 jugadores con stats resaltando al ganador en cada métrica

### Capturas
- Subida a Cloudinary (unsigned preset, gratis sin tarjeta)
- Galería grid responsive (2 cols, 3 cols en pantallas anchas)
- Lightbox con imagen full
- Comentarios por captura (Firestore, tiempo real al cargar)
- Eliminar captura (solo el dueño)
- Eliminar comentario (solo el autor)

### Live game (modal)
- Click en card de jugador en partida → abre modal con datos de la partida
- Equipos Azul y Rojo separados
- Por jugador: icono del campeón, nombre, Riot ID, hechizos de invocador
- Jugador destacado con fondo dorado y marcador ◀
- Data Dragon `champion.json` cargado lazy (una vez por sesión) para mapear ID → nombre

### PWA
- Service Worker registrado para shell offline
- Manifest con nombre, iconos, theme color LoL (#010a13)
- Meta tags para iOS (apple-mobile-web-app)

---

## Flujo de datos (en vivo)

```
Firebase Firestore ──onSnapshot──▶ players[], bans[], shots[]
                                        │
                                   renderPlayers()
                                   renderBans()
                                   renderShots()
                                   renderRanking()

Cloudflare Worker ──/live──▶ liveGames{}  (polling cada 2 min)
                                        │
                                   renderPlayers()  (actualiza badges)
```

---

## Tipos de baneo vigentes

| Clave | Label en UI | Duración | CSS class |
|-------|-------------|----------|-----------|
| `game` | Juego | 3 días / 72h | `.game` (rojo) |
| `chat` | Versión Demo | 7 días / 168h | `.chat` (dorado) |

> "Otro/Custom" fue eliminado. El tipo "Chat" fue renombrado a "Versión Demo".

---

## Decisiones de diseño clave

- **No hay build**: todo es un `.html` estático, fácil de editar y deployar en GitHub Pages.
- **API key de Riot nunca sale al cliente**: el Worker la guarda como Secret en Cloudflare.
- **Firestore como fuente de verdad compartida**: cualquier miembro logueado ve los mismos datos en tiempo real.
- **Data Dragon lazy-loaded**: la versión actual se fetch al inicio; el mapa `champById` se llena solo cuando se abre un modal de partida en vivo.
- **LP sparkline sin librerías**: SVG puro con `<polyline>`, valores normalizados a un score de rank (tier × 10000 + division × 1000 + LP).
- **Polling de partida en vivo**: `setInterval` cada 120 000 ms; no WebSocket para mantenerse en el free tier.
- **Deploy del Worker automatizado**: GitHub Actions (`wrangler-action@v3`) despliega `riot-proxy-worker.js` en cada push a `main`. Credenciales como secrets de GitHub (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`); el `RIOT_API_KEY` queda como Secret en Cloudflare, fuera del repo.
