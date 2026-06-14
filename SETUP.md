# Guía de instalación — La Buena Familia

App web para un grupo de amigos: stats de League of Legends, tracker de baneos con
cuenta regresiva en vivo, y galería de capturas. Datos **compartidos** (todos ven lo
mismo desde cualquier compu/celular).

Arquitectura: **frontend estático** (este `index.html`, hosteable en GitHub Pages) +
**Firebase** (login, base de datos, capturas) + **Cloudflare Worker** opcional (proxy a
la Riot API para las stats automáticas).

Tiempo total: ~20–30 min. Todo gratis.

---

## Paso 1 — Crear el proyecto Firebase (datos compartidos + login)

1. Entrá a https://console.firebase.google.com → **Add project**. Ponele un nombre
   (ej: `lol-squad`). Podés desactivar Google Analytics.
2. **Authentication** → *Get started* → pestaña **Sign-in method** → activá
   **Email/Password** → Save.
3. **Firestore Database** → *Create database* → modo **Production** → elegí la región
   más cercana (ej: `southamerica-east1`).
4. **Storage** → *Get started* → aceptá las reglas por defecto (las cambiamos abajo).
5. Engranaje ⚙ → **Project settings** → bajá hasta *Your apps* → ícono **</>** (Web) →
   registrá la app (ej: `lol-web`). Te muestra un objeto `firebaseConfig`. **Copialo.**

### Pegá la config en la app
Abrí `index.html`, buscá el bloque **CONFIGURACIÓN** y pegá tus valores:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "lol-squad.firebaseapp.com",
  projectId: "lol-squad",
  storageBucket: "lol-squad.appspot.com",
  messagingSenderId: "123...",
  appId: "1:123...:web:abc..."
};
```

> Esta config es pública por diseño (va en el navegador). Lo que protege tus datos son
> las **reglas de seguridad** del paso siguiente, no ocultar la config.

### Cargá las reglas de seguridad
- **Firestore → Rules**: pegá el contenido de [`firestore.rules`](firestore.rules) → *Publish*.
- **Storage → Rules**: pegá el contenido de [`storage.rules`](storage.rules) → *Publish*.

Con esto, solo usuarios logueados leen/escriben, y cada uno solo borra sus propias capturas.

---

## Paso 2 — Hostear el frontend en GitHub Pages

1. Creá un repo en GitHub y subí **todo el contenido de la carpeta `lol-stats-tracker/`**
   (index.html, manifest.json, sw.js, icon.svg).
2. Repo → **Settings → Pages** → *Source*: rama `main`, carpeta `/root` → Save.
3. A los ~1–2 min queda en `https://TU-USUARIO.github.io/TU-REPO/`.
4. **Importante:** en Firebase → Authentication → Settings → **Authorized domains** →
   agregá `TU-USUARIO.github.io` para que el login funcione desde GitHub Pages.

Pasale ese link a tus amigos. Cada uno se registra con su email y ya ven los mismos datos.
En el celular pueden "Agregar a pantalla de inicio" para usarla como app (PWA).

> Alternativa más simple para probar: Firebase Hosting (`firebase deploy`) o Netlify
> arrastrando la carpeta. Cualquier hosting estático sirve.

---

## Paso 3 — (Opcional) Stats automáticas con la Riot API

Sin este paso, la app funciona igual: jugadores, baneos, capturas y botón a **op.gg**.
Con este paso se "encienden" rango, winrate, KDA, campeones y últimas partidas dentro
de la app.

### 3a. Key de Riot
1. Entrá a https://developer.riotgames.com con tu cuenta de Riot.
2. La **Development API Key** sirve para probar pero **expira cada 24 h**.
3. Para algo estable pedí una **Personal API Key** (Register Product → Personal) — se
   aprueba en unos días y no expira.

### 3b. Deploy del proxy (Cloudflare Worker, gratis y sin tarjeta)
1. https://dash.cloudflare.com → **Workers & Pages** → *Create* → *Worker* → nombre →
   *Deploy* → *Edit code*.
2. Borrá lo que haya y pegá el contenido de [`riot-proxy-worker.js`](riot-proxy-worker.js)
   → *Deploy*.
3. En el Worker → **Settings → Variables and Secrets** → *Add* tipo **Secret**:
   - `RIOT_API_KEY` = tu key de Riot.
   - (recomendado) `ALLOWED_ORIGIN` = `https://TU-USUARIO.github.io` para que solo tu
     sitio pueda usar el proxy.
4. Copiá la URL del worker (ej: `https://lol-proxy.tu-user.workers.dev`).

### 3c. Conectá el proxy en la app
En `index.html`, bloque CONFIGURACIÓN:

```js
const RIOT_PROXY_URL = "https://lol-proxy.tu-user.workers.dev";
const REGION = "las"; // las, lan, na, euw, ...
```

Subí el cambio a GitHub. Listo: el botón **↻ Actualizar stats** ya trae datos reales.

> Cómo funciona: el navegador llama al Worker, el Worker agrega tu key secreta y llama a
> Riot, y devuelve solo el resumen. Tu key nunca queda expuesta en el frontend.

---

## Cómo se usa

- **Jugadores**: *+ Agregar jugador* → nombre del invocador + tag (ej `Faker` / `LAS1`).
  Tocá una tarjeta para ver detalle, op.gg y (si configuraste el proxy) sus stats.
- **Baneos**: *+ Registrar baneo* → elegí jugador, tipo (**Juego 3 días** / **Chat 7 días**
  / **Otro** custom), fecha de inicio y nota. La app muestra la cuenta regresiva en vivo
  y pasa el baneo a "Finalizados" cuando se cumple.
- **Capturas**: tocá *Subir*, elegí imagen y ponele título. Tocá una captura para verla
  grande; el que la subió puede eliminarla.

---

## Costos y límites (free tier)

- **Firebase Spark (gratis):** 1 GB Firestore, 5 GB Storage, 50k usuarios/mes. De sobra
  para un grupo de amigos. No requiere tarjeta.
- **Cloudflare Workers (gratis):** 100.000 requests/día. No requiere tarjeta.
- **Riot API:** gratis. La dev key expira cada 24 h; la personal key no.

## Problemas comunes

- *"Falta configurar Firebase"* → no pegaste `firebaseConfig` o falta `apiKey`.
- *El login no anda en GitHub Pages* → agregá tu dominio en Authorized domains (paso 2.4).
- *Las stats no cargan* → revisá `RIOT_PROXY_URL`, que la key no haya expirado, y que el
  Riot ID exista en la región configurada. Probá la URL del worker en el navegador:
  `…/profile?gameName=NOMBRE&tagLine=TAG&region=las`.
- *No suben las capturas* → revisá que publicaste `storage.rules` y activaste Storage.
