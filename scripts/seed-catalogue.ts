import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
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

type ExternalGame = {
    id: number;
    game?: number;
    uid?: string;
    name?: string;
};

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
    console.log("Token acquired. Seeding catalogue.\n");

    let lastId = 0;
    let page = 0;
    let fetched = 0;
    let written = 0;
    let skipped = 0;

    while (true) {
       const rows: ExternalGame[] = await igdb(
        "external_games",
        `fields game, uid, name; where external_game_source = 1 & id > ${lastId}; sort id asc; limit ${PAGE_SIZE};`,
        token
       );

        if (rows.length === 0) break;

        page++;
        fetched += rows.length;
        lastId = rows[rows.length - 1].id;

        const usable = rows.filter(
            (r) => r.game != null && r.uid != null && /^\d+$/.test(r.uid) && r.name
        );
        skipped += rows.length - usable.length;

        const igdbGames = new Map<number, string>();
        for (const r of usable) {
            if (!igdbGames.has(r.game!)) igdbGames.set(r.game!, r.name!);
        }

        await prisma.igdbGame.createMany({
            data: [...igdbGames].map(([id, name]) => ({ id, name })),
            skipDuplicates: true,
        });

        const result = await prisma.game.createMany({
            data: usable.map((r) => ({
                steamAppId: Number(r.uid),
                name: r.name!,
                matchStatus: "MATCHED" as const,
                igdbGameId: r.game!,
            })),
            skipDuplicates: true,
        });

        written += result.count;

        if (page % 10 === 0) {
            console.log(
                `page ${page} | fetched ${fetched} | written ${written} | skipped ${skipped}`
            );
        }

        await sleep(DELAY_MS);
    }

    console.log(`\nDone. ${page} pages, ${fetched} rows fetched.`);
    console.log(`${written} games writte, ${skipped} rows skipped.`);
    console.log(
        `Database hold ${await prisma.game.count()} games, ` +
        `${await prisma.igdbGame.count()} IGDB entries.`
    );
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());