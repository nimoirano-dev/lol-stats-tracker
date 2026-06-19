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
- **Seguimiento (2026-06-17):** el card "🤡 Ranking de vergüenza" se renombró a "🪶 Ranking de Poetas Contemporáneos" para mantener la coherencia con el award "Mejor poeta".

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

## v1.1 — Repo dentro de la bóveda y limpieza
**Decisiones y razones:**
- El proyecto se **movió a la bóveda de Obsidian** (`E:\Obsidian\Mi Base de Conocimiento\02 - Proyectos\La Buena Familia\lol-stats-tracker\`), saliendo de `C:\...\OneDrive\...\Code`.
  - **Motivo:** eliminar la duplicación de docs entre la carpeta del código y Obsidian, y tener una sola fuente de verdad editable desde Obsidian y pusheable a GitHub desde la misma carpeta.
  - **Backup:** pasa a ser GitHub en lugar de OneDrive.
- **Docs consolidados:** `CHANGELOG_AI.md` y `PROJECT_CONTEXT.md` (en el repo) son la fuente de verdad. Las notas homónimas de Obsidian se convirtieron en **punteros** que enlazan a estas, para no romper backlinks existentes (ej: notas de cierre de sesión).
- **`storage.rules` eliminado:** las capturas van por Cloudinary, no Firebase Storage, así que las reglas de Storage no se usaban.

---

## v1.2 — Botón "Espectar" (Porofessor)
**Decisiones y razones:**
- Se agregó botón **🔴 Espectar** que abre `porofessor.gg/es/live/{region}/{gameName}-{tagLine}` en una pestaña nueva.
  - **Motivo:** ver la partida "en directo" requiere el modo espectador del cliente de League (Riot no da stream de video embebible). Porofessor ya resuelve todo ese flujo (abre el cliente con el delay oficial de ~3 min). Se eligió esta opción sobre lanzar el cliente nativo a mano (frágil, solo Windows, requiere ruta del `LeagueClient`).
- **Ubicación:** botón prominente en el modal de partida en vivo (`openLiveModal`) + botón condicional en el detalle del jugador (`openPlayerDetail`), visible solo si `liveGames[p.id].inGame`.
- Helper `spectateUrl(p)` junto a `opggUrl(p)`.

---

## v1.3 — Mejoras de live, ranking y robustez
**Decisiones y razones.** Lote de 6 mejoras; 5 de ellas con **cero llamadas extra** a la Riot API (clave dado el rate limit de 100 req/2min):

- **🔔 Aviso al entrar en partida:** `checkLiveGames` compara el estado previo y dispara un toast cuando un familiar pasa a `inGame`. Flag `liveFirstRun` evita avisar de partidas ya en curso al cargar. (0 llamadas)
- **🔑 Banner de API key vencida:** si el Worker responde 401/403 (o el body lo contiene), se muestra un banner fijo no intrusivo. Detección en `refreshPlayer` y en el polling `/live`. Frontend puro, sin tocar el Worker. (0 llamadas)
- **📊 Carrera de poeta:** historial de baneos del jugador en el modal de detalle (`openPlayerDetail`), desde Firestore. (0 llamadas)
- **🏆 Premios nuevos (positivos):** "En racha" (victorias seguidas), "El granjero" (mejor CS/min), "El centinela" (mejor visión), calculados desde `cachedStats.matches`. Se eligieron premios que **honran** (permitido por la policy de Riot) en vez de más "shame". (0 llamadas)
- **🪶 Bans del draft en el modal en vivo:** el Worker `/live` ahora devuelve `bans` (de `bannedChampions`, que ya venían en la respuesta del spectator). El frontend los renderiza por equipo con íconos. (0 llamadas)
- **⏱️ Auto-refresh de stats viejas:** al cargar, refresca jugadores con stats de >1h, **de a uno con 3s de pausa y tope de 5 por carga** (cada refresh ~13 llamadas) para quedar bien debajo de 100/2min. Flag `autoRefreshDone` para correr una sola vez.

> **Decisión de scope:** el rango de cada participante en el modal en vivo se dejó **fuera** por ahora — serían ~10 llamadas extra por chequeo cada 2 min (riesgo de rate limit). Queda como posible carga bajo demanda al abrir el modal.

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
