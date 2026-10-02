import "dotenv/config";

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in .env");
}

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
    console.log(`Token expires in ${Math.round(data.expires_in / 86400)} days`);
    return data.access_token;
}

async function igdb(endpoint: string, query: string, token: string) {
    const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
        method: "POST",
        headers: {
            "Client-ID": CLIENT_ID!,
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
        },
        body: query,
    });

    if (!res.ok) {
        throw new Error(`IGDB ${endpoint} failed: ${res.status} ${await res.text()}`);
    }

    return res.json();
}

async function main() {
    const token = await getAccessToken();

    const modes = await igdb("game_modes", `fields id, name, slug; limit 50;`, token);
    console.log("game modes:");
    console.log(JSON.stringify(modes, null, 2));

    const samples = await igdb(
        "games",
        `fields id, name, game_modes; where id = (25076, 1372, 1877);`,
        token
    );
    console.log("\nsample games:");
    console.log(JSON.stringify(samples, null, 2));
}

main();