/* ============================================================
   Riot API Proxy  —  Cloudflare Worker  v2
   ------------------------------------------------------------
   Endpoints:
     GET /profile?gameName=X&tagLine=Y&region=las
       → cuenta + rango solo + rango flex + campeones + partidas
         con CS, daño, duración ampliados
     GET /live?puuid=X&region=las
       → si el invocador está en partida ahora mismo

   DEPLOY (gratis, sin tarjeta):
   1) dash.cloudflare.com → Workers & Pages → Create → Worker
   2) Pegá este archivo → Deploy
   3) Settings → Variables → Secret:
        RIOT_API_KEY = tu key de developer.riotgames.com
      (opcional) ALLOWED_ORIGIN = https://TU-USUARIO.github.io
   ============================================================ */

const ROUTING = {
  las:  { platform: "la2",  regional: "americas" },
  lan:  { platform: "la1",  regional: "americas" },
  na:   { platform: "na1",  regional: "americas" },
  br:   { platform: "br1",  regional: "americas" },
  euw:  { platform: "euw1", regional: "europe"   },
  eune: { platform: "eun1", regional: "europe"   },
  kr:   { platform: "kr",   regional: "asia"     },
  jp:   { platform: "jp1",  regional: "asia"     },
  oce:  { platform: "oc1",  regional: "americas" },
};

const QUEUE_NAMES = {
  420: "Ranked Solo", 440: "Ranked Flex", 400: "Normal Draft",
  430: "Normal Blind", 450: "ARAM", 700: "Clash",
  900: "URF", 1020: "URF", 830: "Co-op vs AI", 0: "Custom"
};

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    /* ---- /access-request : avisa a Discord (no usa RIOT_API_KEY) ---- */
    if (new URL(request.url).pathname === "/access-request") {
      if (request.method !== "POST") return json({ error: "Usá POST" }, 405, cors);
      if (!env.DISCORD_WEBHOOK_URL) return json({ error: "Falta DISCORD_WEBHOOK_URL" }, 500, cors);
      try {
        const body = await request.json();
        const email = String(body.email || "").slice(0, 120);
        const name  = String(body.name  || "").slice(0, 80);
        await fetch(env.DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title: "🔐 Nueva solicitud de acceso",
              description: `**${name || "Sin nombre"}** quiere entrar a La Buena Familia`,
              fields: [{ name: "Email", value: email || "—" }],
              color: 0xc8aa6e,
            }],
          }),
        });
        return json({ ok: true }, 200, cors);
      } catch (err) {
        return json({ error: String(err.message) }, 502, cors);
      }
    }

    if (!env.RIOT_API_KEY) return json({ error: "Falta RIOT_API_KEY en el worker" }, 500, cors);

    const url = new URL(request.url);
    const region = (url.searchParams.get("region") || "las").toLowerCase();
    const route = ROUTING[region] || ROUTING.las;
    const H = { headers: { "X-Riot-Token": env.RIOT_API_KEY } };
    const rget = async (u) => {
      const r = await fetch(u, H);
      if (!r.ok) throw new Error(`Riot ${r.status} @ ${u}`);
      return r.json();
    };

    /* ---- /live ---- */
    if (url.pathname === "/live") {
      const puuid = url.searchParams.get("puuid");
      if (!puuid) return json({ error: "Falta puuid" }, 400, cors);
      try {
        const data = await rget(`https://${route.platform}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(puuid)}`);
        const participants = (data.participants || []).map(p => ({
          teamId:       p.teamId,
          puuid:        p.puuid,
          riotId:       p.riotId || "",
          championId:   p.championId,
          profileIconId:p.profileIconId,
          spell1Id:     p.spell1Id,
          spell2Id:     p.spell2Id,
        }));
        // Bans del draft (vienen en la misma respuesta del spectator, sin costo extra). -1 = sin baneo.
        const bans = (data.bannedChampions || [])
          .filter(b => b.championId > 0)
          .map(b => ({ championId: b.championId, teamId: b.teamId, pickTurn: b.pickTurn }));
        return json({
          inGame: true,
          queueId:  data.gameQueueConfigId,
          queue:    QUEUE_NAMES[data.gameQueueConfigId] || "Partida",
          duration: data.gameLength,
          gameMode: data.gameMode,
          participants,
          bans,
        }, 200, cors);
      } catch (err) {
        if (String(err.message).includes("404")) return json({ inGame: false }, 200, cors);
        return json({ error: String(err.message) }, 502, cors);
      }
    }

    /* ---- /profile ---- */
    if (url.pathname !== "/profile") {
      return json({ error: "Endpoints disponibles: /profile o /live" }, 404, cors);
    }

    const gameName = url.searchParams.get("gameName");
    const tagLine  = url.searchParams.get("tagLine");
    if (!gameName || !tagLine) return json({ error: "Faltan gameName/tagLine" }, 400, cors);

    try {
      // 1) Riot ID → PUUID
      const acct = await rget(
        `https://${route.regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
      );
      const puuid = acct.puuid;

      // 2) Summoner (icono, nivel)
      let summoner = {};
      try { summoner = await rget(`https://${route.platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`); } catch {}

      // 3) Ranked Solo + Flex
      let rank = null, flexRank = null;
      try {
        const entries = await rget(`https://${route.platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`);
        const solo = entries.find(e => e.queueType === "RANKED_SOLO_5x5");
        const flex = entries.find(e => e.queueType === "RANKED_FLEX_SR");
        if (solo) rank     = { tier: cap(solo.tier), division: solo.rank, lp: solo.leaguePoints, wins: solo.wins, losses: solo.losses };
        if (flex) flexRank = { tier: cap(flex.tier), division: flex.rank, lp: flex.leaguePoints, wins: flex.wins, losses: flex.losses };
      } catch {}

      // 4) Últimas 10 partidas con stats ampliadas
      let matches = [], topChamps = [], kda = null;
      try {
        const ids = await rget(`https://${route.regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=10`);
        const champCount = {};
        let tk=0, td=0, ta=0, n=0;
        for (const id of ids) {
          try {
            const match = await rget(`https://${route.regional}.api.riotgames.com/lol/match/v5/matches/${id}`);
            const p = match.info.participants.find(x => x.puuid === puuid);
            if (!p) continue;
            const dur = match.info.gameDuration || 0;
            const cs  = (p.totalMinionsKilled||0) + (p.neutralMinionsKilled||0);
            matches.push({
              champion:    p.championName,
              win:         p.win,
              kills:       p.kills,
              deaths:      p.deaths,
              assists:     p.assists,
              kdaRatio:    ((p.kills + p.assists) / Math.max(1, p.deaths)).toFixed(2),
              cs,
              csPerMin:    dur > 0 ? +((cs / (dur / 60)).toFixed(1)) : null,
              damage:      p.totalDamageDealtToChampions,
              visionScore: p.visionScore ?? null,
              duration:    dur,
              queueId:     match.info.queueId,
              queue:       QUEUE_NAMES[match.info.queueId] || "",
              ago:         timeAgo(match.info.gameEndTimestamp || match.info.gameCreation),
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
        profileIconId:  summoner.profileIconId  ?? null,
        summonerLevel:  summoner.summonerLevel  ?? null,
        rank, flexRank, kda, topChamps, matches
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
function cap(s) { return s ? s[0] + s.slice(1).toLowerCase() : s; }
function timeAgo(ms) {
  const s = Math.floor((Date.now()-ms)/1000);
  if (s < 3600)  return `${Math.floor(s/60)} min`;
  if (s < 86400) return `${Math.floor(s/3600)} h`;
  return `${Math.floor(s/86400)} d`;
}
