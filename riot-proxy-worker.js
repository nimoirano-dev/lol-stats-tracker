/* ============================================================
   Riot API Proxy  —  Cloudflare Worker
   ------------------------------------------------------------
   Guarda tu RIOT_API_KEY de forma segura (nunca llega al
   navegador) y le da al frontend un único endpoint /profile
   que junta cuenta + rango + campeones + últimas partidas.

   DEPLOY (gratis, sin tarjeta):
   1) Crear cuenta en https://dash.cloudflare.com
   2) Workers & Pages → Create → Worker → pegá este archivo.
   3) Settings → Variables → agregá una "Secret":
        RIOT_API_KEY = tu key de developer.riotgames.com
      (opcional) ALLOWED_ORIGIN = https://TU-USUARIO.github.io
   4) Deploy. Copiá la URL del worker y pegala en index.html
      como RIOT_PROXY_URL.
   ============================================================ */

// Mapa región op.gg/cliente -> hosts de Riot
const ROUTING = {
  las: { platform: "la2", regional: "americas" },
  lan: { platform: "la1", regional: "americas" },
  na:  { platform: "na1", regional: "americas" },
  br:  { platform: "br1", regional: "americas" },
  euw: { platform: "euw1", regional: "europe" },
  eune:{ platform: "eun1", regional: "europe" },
  kr:  { platform: "kr",  regional: "asia" },
  jp:  { platform: "jp1", regional: "asia" },
  oce: { platform: "oc1", regional: "americas" },
};

const QUEUE_NAMES = {
  420: "Ranked Solo", 440: "Ranked Flex", 400: "Normal Draft",
  430: "Normal Blind", 450: "ARAM", 700: "Clash", 0: "Custom"
};

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== "/profile") {
      return json({ error: "Usá /profile?gameName=X&tagLine=Y&region=las" }, 404, cors);
    }
    if (!env.RIOT_API_KEY) return json({ error: "Falta RIOT_API_KEY en el worker" }, 500, cors);

    const gameName = url.searchParams.get("gameName");
    const tagLine = url.searchParams.get("tagLine");
    const region = (url.searchParams.get("region") || "las").toLowerCase();
    const route = ROUTING[region] || ROUTING.las;
    if (!gameName || !tagLine) return json({ error: "Faltan gameName/tagLine" }, 400, cors);

    const H = { headers: { "X-Riot-Token": env.RIOT_API_KEY } };
    const rget = async (u) => {
      const r = await fetch(u, H);
      if (!r.ok) throw new Error(`Riot ${r.status} @ ${u}`);
      return r.json();
    };

    try {
      // 1) Riot ID -> PUUID
      const acct = await rget(`https://${route.regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
      const puuid = acct.puuid;

      // 2) Summoner (icono, nivel)
      let summoner = {};
      try { summoner = await rget(`https://${route.platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`); } catch {}

      // 3) Ranked
      let rank = null;
      try {
        const entries = await rget(`https://${route.platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`);
        const solo = entries.find(e => e.queueType === "RANKED_SOLO_5x5") || entries[0];
        if (solo) rank = {
          tier: cap(solo.tier), division: solo.rank, lp: solo.leaguePoints,
          wins: solo.wins, losses: solo.losses, queue: solo.queueType
        };
      } catch {}

      // 4) Últimas partidas
      let matches = [], topChamps = [], kda = null;
      try {
        const ids = await rget(`https://${route.regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=8`);
        const champCount = {};
        let tk=0, td=0, ta=0, n=0;
        for (const id of ids) {
          try {
            const match = await rget(`https://${route.regional}.api.riotgames.com/lol/match/v5/matches/${id}`);
            const p = match.info.participants.find(x => x.puuid === puuid);
            if (!p) continue;
            matches.push({
              champion: p.championName, win: p.win,
              kills: p.kills, deaths: p.deaths, assists: p.assists,
              kdaRatio: ((p.kills + p.assists) / Math.max(1, p.deaths)).toFixed(2),
              queue: QUEUE_NAMES[match.info.queueId] || "",
              ago: timeAgo(match.info.gameEndTimestamp || match.info.gameCreation)
            });
            champCount[p.championName] = (champCount[p.championName]||0)+1;
            tk+=p.kills; td+=p.deaths; ta+=p.assists; n++;
          } catch {}
        }
        if (n) kda = ((tk+ta)/Math.max(1,td)).toFixed(2);
        topChamps = Object.entries(champCount).sort((a,b)=>b[1]-a[1]).slice(0,4)
          .map(([name,games]) => ({ name, games }));
      } catch {}

      return json({
        gameName: acct.gameName, tagLine: acct.tagLine, puuid,
        profileIconId: summoner.profileIconId ?? null,
        summonerLevel: summoner.summonerLevel ?? null,
        rank, kda, topChamps, matches
      }, 200, cors);

    } catch (err) {
      return json({ error: String(err.message || err) }, 502, cors);
    }
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json", ...cors }
  });
}
function cap(s){ return s ? s[0] + s.slice(1).toLowerCase() : s; }
function timeAgo(ms){
  const s = Math.floor((Date.now()-ms)/1000);
  if (s<3600) return `${Math.floor(s/60)} min`;
  if (s<86400) return `${Math.floor(s/3600)} h`;
  return `${Math.floor(s/86400)} d`;
}
