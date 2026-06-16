# CHANGELOG AI — La Buena Familia · LoL Tracker
> Decisiones técnicas y de producto tomadas durante el desarrollo con IA.
> Ordenado cronológicamente (más reciente al final).

---

## v0.1 — Base inicial
**Decisiones:**
- Single-file PWA (HTML + CSS + JS vanilla) en lugar de React/Vue para evitar build step y simplificar el deploy en GitHub Pages.
- Firebase Spark (gratis) para Auth y Firestore. Sin Storage de Firebase (límite bajo en Spark) → se usó Cloudinary para imágenes.
- Cloudflare Worker como proxy de Riot API para mantener la API key fuera del cliente.
- Autenticación con email/password (Firebase Auth). Sin OAuth/Google para no complicar la configuración inicial.
- Firestore `onSnapshot` para datos en tiempo real compartidos entre todos los miembros del grupo.

---

## v0.2 — Baneos y timeline
**Decisiones:**
- Tipos de baneo limitados a dos categorías fijas en lugar de duración libre, para simplificar el UX del formulario.
- Timeline Gantt en CSS/SVG puro (sin librerías de charts) para mantener el bundle a cero.
- Countdown en vivo con `setInterval` de 1 segundo, actualizando solo los nodos `.countdown` sin re-render completo del DOM.
- Scroll automático del Gantt a la zona del "hoy" al montar.

---

## v0.3 — Ranking y premios
**Decisiones:**
- Leaderboard ordenado por score calculado: `tier × 10000 + division × 1000 + LP`. Permite comparar cualquier par de rangos con un solo número.
- Premios auto-calculados en el cliente desde los datos de Firestore. No se guardan en la DB — son efímeros y se recalculan en cada render.
- Comparador de dos jugadores en modal con resaltado del ganador en cada métrica (verde).

---

## v0.4 — Stats ampliadas del Worker
**Decisiones:**
- Worker v2: se agregó CS, CS/min, daño a campeones, vision score y duración a cada partida en el endpoint `/profile`.
  - `CS = totalMinionsKilled + neutralMinionsKilled`
  - `csPerMin = CS / (gameDuration / 60)`, redondeado a 1 decimal.
- Se agregó `flexRank` (Ranked Flex SR) en paralelo al `rank` (Solo/Duo) en la misma llamada a la League API.
- `puuid` incluido en la respuesta del Worker para que el frontend pueda usarlo en el endpoint `/live`.

---

## v0.5 — Toggle de cola y sparkline LP
**Decisiones:**
- Toggle Solo/Duo vs Flex visible solo cuando el jugador tiene datos de Flex, para no mostrar controles vacíos.
- LP Sparkline en SVG puro: usa el mismo `rankScore` que el leaderboard para normalizar valores de distintos tiers en un solo eje Y.
- Historial guardado en Firestore como array `lpHistory` (máx 30 puntos) acumulativo. Cada `refreshPlayer()` agrega un punto nuevo.

---

## v0.6 — Reacciones y comentarios
**Decisiones:**
- Reacciones en baneos almacenadas en el documento del baneo mismo como `reactions: { emoji: [uid1, uid2] }`. Toggle: si ya está el UID se quita, si no se agrega. Esto permite una UI optimista sin transacciones.
- Emojis de reacción hardcodeados: 🤡 😤 💀 😂 🎮 🫡. Sin emoji picker para simplicidad.
- Comentarios en capturas: colección separada `comments` con `screenshotId` como FK. Requiere índice compuesto Firestore (`screenshotId ASC` + `createdAt ASC`) que Firestore detecta automáticamente y da link para crear.
- Regla de Firestore: solo el autor puede borrar su comentario; todos los firmados pueden leer.

---

## v0.7 — Live game badge
**Decisiones:**
- Polling cada 2 minutos (`setInterval(checkLiveGames, 120000)`) en lugar de WebSocket. Mantiene compatibilidad con free tier de Cloudflare Workers y Riot API Personal Key.
- `liveGames` es un objeto en memoria `{ [playerId]: { inGame, queue, duration, participants } }`. Se descarta al refrescar la página.
- Badge verde en la player card muestra tipo de cola y duración formateada en `M:SS`.
- Click en card de jugador en partida → abre modal de live game (no el modal de perfil).
- Si `puuid` no está en `cachedStats` (jugadores añadidos antes del Worker v2), la verificación de live se saltea silenciosamente. Fix: el usuario debe hacer "Actualizar stats".

---

## v0.8 — Modal de partida en vivo
**Decisiones:**
- Endpoint `/live` del Worker extendido para retornar `participants[]` completo: `teamId`, `puuid`, `riotId`, `championId`, `profileIconId`, `spell1Id`, `spell2Id`.
- Resolución de `championId → nombre` en el frontend (no en el Worker) via Data Dragon `champion.json`. Lazy-loaded una vez por sesión en `champById`. Evita hardcodear ~170 campeones o hacer llamadas extra por jugador en el Worker.
- `SPELL_NAMES` hardcodeado en el frontend (los hechizos de invocador no cambian frecuentemente): Flash, Ignite, Teleport, etc.
- Jugador "propio" (que pertenece a la familia) destacado en dorado con marcador ◀.
- Equipos separados visualmente: Azul (#5b9bd5) y Rojo (#ec5453).

---

## v0.9 — Cambios de verbiage y limpieza de features
**Decisiones y razones:**

### "Chat ban" → "Versión Demo"
- **Motivo:** el grupo de amigos usa el término "Versión Demo" para referirse al modo restringido de chat.
- **Cambio:** `BAN_TYPES.chat.label = "Versión Demo"` (clave interna sin cambios para no romper datos existentes).
- **UI:** el formulario muestra "Versión Demo", los tags y barras del Gantt mantienen estilo dorado existente.

### Eliminación de "Otro/Custom"
- **Motivo:** no se usaba, complicaba la UI del formulario y el Gantt.
- **Cambio:** `BAN_TYPES` pasó de 3 entradas a 2. El formulario de ban usa `<div class="seg">` con solo dos opciones.

### "Más baneado" → "Mejor poeta" (🪶)
- **Motivo:** el grupo prefería un término irónico/literario. "Poeta" en jerga argentina refiere a alguien que "escribe" mucho en el chat (habla de más).
- **Cambio:** emoji cambió de 🤡 a 🪶, label de "Más baneado" a "Mejor poeta".

### Eliminación del award "Main de campeón"
- **Motivo:** la lógica que mostraba el campeón más jugado no tenía suficiente contexto (era de las últimas 10 partidas, no el "main" real).
- **Cambio:** bloque de award completamente removido de `renderAwards()`.

---

## v1.0 — CI/CD automático del Worker
**Decisiones y razones:**
- Se agregó deploy automático del Cloudflare Worker vía GitHub Actions (`.github/workflows/deploy-worker.yml`). Antes el deploy era manual (copiar/pegar el archivo en el editor de Cloudflare); ahora cada push a `main` que toque `riot-proxy-worker.js` o `wrangler.toml` dispara el deploy con `wrangler-action@v3`.
- **Motivo:** eliminar el paso manual propenso a olvidos y mantener Cloudflare siempre sincronizado con el repo.
- Se agregó `wrangler.toml` (`name = "la-buena-familia"`, `main = "riot-proxy-worker.js"`) como configuración del deploy.
- Credenciales como secrets de GitHub: `CLOUDFLARE_API_TOKEN` (token "Edit Cloudflare Workers") y `CLOUDFLARE_ACCOUNT_ID`. Nunca en el repo.
- **Cambio de arquitectura:** `riot-proxy-worker.js` ahora SÍ vive en el repo (antes estaba marcado como "no va a GitHub").
- El `RIOT_API_KEY` sigue siendo un Secret en Cloudflare, no se gestiona desde el CI.

---

## Estado de deploys requeridos por el usuario

Cada vez que se modifica `index.html` → subir a GitHub Pages (rama `main` o `gh-pages`).
Cada vez que se modifica `riot-proxy-worker.js` → push a `main`; GitHub Actions lo despliega solo en Cloudflare (ya no se pega a mano).
Cada vez que se modifica `firestore.rules` → publicar en Firebase Console → Firestore → Rules.

---

## Notas de compatibilidad

- **Riot Spectator API v5** usa `puuid` como identificador del jugador en la URL (no `summonerId`). El Worker usa `active-games/by-summoner/{puuid}` que acepta PUUID en v5.
- **Data Dragon versión**: se fetch dinámicamente de `ddragon.leagueoflegends.com/api/versions.json` al inicio; fallback hardcodeado `"15.11.1"`.
- **Firebase SDK**: `10.12.2` (ESM, importado desde CDN de Google). Sin Service Account — todo desde el cliente con reglas de seguridad.
- **Índice compuesto Firestore necesario**: `comments` con `screenshotId ASC` + `createdAt ASC`. Firestore loguea el link para crearlo si falta.
