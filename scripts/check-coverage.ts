import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const DB_URL = process.env.DATABASE_URL_UNPOOLED;
const steamId = process.argv[2];

if(!STEAM_API_KEY) throw new Error("Missing STEAM_API_KEY in .env");
if(!DB_URL) throw new Error("Missing DATABASE_URL_UNPOOLED in .env");
if(!steamId) throw new Error("Usage: npx tsx scripts/check-coverage.ts 76561198076437324");

const adapter = new PrismaNeon({ connectionString: DB_URL });
const prisma = new PrismaClient({ adapter });

type SteamGame = {
    appid: number;
    name?: string;
    playtime_forever: number;
};

async function getOwnedGames(): Promise<SteamGame[]> {
    const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1");
    url.searchParams.set("key", STEAM_API_KEY!);
    url.searchParams.set("steamid", steamId!);
    url.searchParams.set("include_appinfo", "1");
    url.searchParams.set("include_played_free_games", "1");
    url.searchParams.set("format", "json");

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Steam API failed: ${res.status} ${await res.text()}`);

    const data = await res.json();
    if (!data.response || data.response.games === undefined) {
        throw new Error("Steam returned no games - the profile or its game details are private.");
    }
    return data.response.games;
}

async function main() {
    const games = await getOwnedGames();

    const rows = await prisma.game.findMany({
        where: { steamAppId: { in: games.map((g) => g.appid) } },
        include: { igdbGame: true },
    });
    const byAppId = new Map(rows.map((r) => [r.steamAppId!, r]));

    let matched = 0;
    let withTtb = 0;
    let played = 0;
    let playedWithTtb = 0;

    for (const g of games) {
        const row = byAppId.get(g.appid);
        const hasTtb = row?.igdbGame?.normallySeconds != null;
        if (row) matched++;
        if (hasTtb) withTtb++;
        if (g.playtime_forever > 0) {
            played++;
            if (hasTtb) playedWithTtb++;
        }
    }

    const pct = (n: number, d: number) => (d === 0 ? "-" : `${((n / d) * 100).toFixed(1)}%`);

    console.log("\nCOVERAGE");
    console.log(`  owned apps:                  ${games.length}`);
    console.log(`  found in catalogue:          ${matched} (${pct(matched, games.length)})`);
    console.log(`  with a time-to-beat:         ${withTtb} (${pct(withTtb, games.length)})`);
    console.log(`  played at all:               ${played}`);
    console.log(`  played AND time-to-beat:     ${playedWithTtb} (${pct(playedWithTtb, played)})`);

    const OVERSHOT = 1.2;
    const NEARLY_DONE = 0.7;
    const BARELY_STARTED = 0.1;

    const rated = games
        .filter((g) => g.playtime_forever > 0)
        .map((g) => {
            const normally = byAppId.get(g.appid)?.igdbGame?.normallySeconds;
            if (normally == null) return null;
            const hours = g.playtime_forever / 60;
            const estHours = normally / 3600;
            return { name: g.name ?? String(g.appid), hours, estHours, ratio: hours / estHours };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

    const bucketOf = (r: number) =>
        r > OVERSHOT ? "no-commitment"
        : r >= NEARLY_DONE ? "(probably done)"
        : r >= BARELY_STARTED ? "good-progress"
        : "(barely started)";

    const counts = new Map<string, number>();
    for (const g of rated) {
        const b = bucketOf(g.ratio);
        counts.set(b, (counts.get(b) ?? 0) + 1);
    }

    console.log(`\nBUCKETS (${rated.length} games with playtime and estimate)`);
    for (const [b, n] of [...counts].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${b.padEnd(20)} ${n}`);
    }

    console.log("\nGOOD-PROGRESS (ascending ratio)");
    rated
        .filter((g) => g.ratio >= BARELY_STARTED && g.ratio < NEARLY_DONE)
        .sort((a, b) => a.ratio - b.ratio)
        .forEach((g) =>
        console.log(
            `  ${g.ratio.toFixed(2)} ${g.name.slice(0, 38).padEnd(40)} ${g.hours.toFixed(1)}h of ~${g.estHours.toFixed(1)}h`
        )
    );
}

main()
    .catch((e) => {
        console.error(e.message ?? e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());