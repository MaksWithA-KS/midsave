import "dotenv/config";
import { PrismaClient, Prisma } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const DB_URL = process.env.DATABASE_URL_UNPOOLED;

if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in .env");
}
if (!DB_URL) {
    throw new Error("Missing DATABASE_URL_UNPOOLED in .env");
}

const adapter = new PrismaNeon({ connectionString: DB_URL });
const prisma = new PrismaClient({ adapter });

const PAGE_SIZE = 500;
const DELAY_MS = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getAccessToken(): Promise<string> {
    const url = new URL("https://id.twitch.tv/oauth2/token");
    url.searchParams.set("client_id", CLIENT_ID!);
    url.searchParams.set("client_secret", CLIENT_SECRET!);
    url.searchParams.set("grant_type", "client_credentials");

    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
        throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return data.access_token;
}

type GameRow = {
    id: number;
    game_modes?: number[];
}

async function igdb(endpoint: string, query: string, token: string) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
            method: "POST",
            headers: {
                "Client-ID": CLIENT_ID!,
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            body: query,
        });

        if (res.status === 429) {
            const wait = 1000 * 2 ** attempt;
            console.log(`  rate limited, backing off ${wait}ms`);
            await sleep(wait);
            continue;
        }

        if (!res.ok) {
            throw new Error(`IGDB ${endpoint} failed: ${res.status} ${await res.text()}`);
        }
        return res.json();
    }
    throw new Error(`IGDB ${endpoint} gave up after 5 attempts`);
}

async function main() {
    const token = await getAccessToken();
    console.log("Token acquired. Seeding game mode data.\n");

    let lastId = 0;
    let page = 0;
    let fetched = 0;
    let updated = 0;

    while (true) {
        const rows: GameRow[] = await igdb(
            "games",
            `fields id, game_modes; where game_modes != null & id > ${lastId}; sort id asc; limit ${PAGE_SIZE};`,
            token
        );

        if (rows.length === 0) break;

        page++;
        fetched += rows.length;
        lastId = rows[rows.length - 1].id;

        const usable = rows.filter((r) => r.game_modes && r.game_modes.length > 0);

        if (usable.length > 0) {
            const values = Prisma.join(
                usable.map(
                    (r) => { 
                        const modes = r.game_modes!.filter((m) => Number.isInteger(m));
                        return Prisma.sql`(${r.id}::int, ${`{${modes.join(",")}}`}::int[])`;
                    })
            );

            updated += await prisma.$executeRaw`
            UPDATE "IgdbGame" AS t
            SET "gameModes" = v.modes            
            FROM (VALUES ${values})
                AS v(game_id, modes)
            WHERE t.id = v.game_id
            `;
        }

        if (page % 10 === 0) {
            console.log(`page ${page} | fetched ${fetched} | matched ${updated}`);
        }

        await sleep(DELAY_MS);
    }

    console.log(`\nDone. ${page} pages, ${fetched} game modes rows fetched.`);
    console.log(`${updated} matched a game in our catalogue.\n`);

   const stats = await prisma.$queryRaw<
   { with_modes: number; multiplayer_only: number }[]
   >`
        SELECT
            COUNT(*) FILTER (WHERE array_length("gameModes", 1) > 0)::int AS with_modes,
            COUNT(*) FILTER (
                WHERE array_length("gameModes", 1) > 0 AND NOT (1 = ANY("gameModes"))
                )::int AS multiplayer_only
            FROM "IgdbGame"
            `;

    console.log(`catalogue entries with modes: ${stats[0].with_modes}`);
    console.log(`multiplayer-only: ${stats[0].multiplayer_only}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());