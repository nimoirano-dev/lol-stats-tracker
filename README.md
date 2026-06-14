# ⚔ La Buena Familia

App web para el grupo: seguí las stats de League of Legends de todos,
registrá baneos con cuenta regresiva en vivo y compartí capturas. **Datos compartidos**:
todos ven lo mismo desde cualquier compu o celular.

## Qué hace
- **Jugadores** — agregá los Riot ID del grupo y mirá rango, winrate, KDA, campeones más
  jugados y últimas partidas (vía Riot API), más un botón directo a su perfil de **op.gg**.
- **Baneos** — cargá tipo (Juego 3 días / Chat 7 días / custom) y fecha de inicio; la app
  muestra **días, horas, minutos y segundos** restantes en vivo y archiva los cumplidos.
- **Capturas** — galería compartida; cada uno sube y borra las suyas.
- **PWA** — instalable en el celular ("Agregar a pantalla de inicio").

## Stack
- Frontend: **un solo `index.html`**, vanilla JS, sin build. Hosteable en GitHub Pages.
- Backend: **Firebase** (Auth con email + Firestore + Storage), por CDN.
- Stats de Riot: **Cloudflare Worker** (`riot-proxy-worker.js`) que guarda la API key segura.

## Puesta en marcha
Seguí **[SETUP.md](SETUP.md)** paso a paso (~20–30 min, todo gratis):
1. Crear proyecto Firebase y pegar `firebaseConfig` en `index.html`.
2. Publicar las reglas (`firestore.rules`, `storage.rules`).
3. Subir la carpeta a GitHub Pages.
4. (Opcional) Desplegar el Worker de Riot y pegar `RIOT_PROXY_URL`.

La app funciona desde el paso 1; las stats automáticas de Riot se activan en el paso 4.

## Archivos
| Archivo | Para qué |
|---|---|
| `index.html` | La app entera (UI + lógica). Acá va la config. |
| `riot-proxy-worker.js` | Worker de Cloudflare: proxy seguro a la Riot API. |
| `firestore.rules` / `storage.rules` | Reglas de seguridad de Firebase. |
| `manifest.json`, `sw.js`, `icon.svg` | PWA (instalable / offline shell). |
| `SETUP.md` | Guía de instalación detallada. |
