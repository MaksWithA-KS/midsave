import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const game = await prisma.game.findFirst();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-medium">midsave</h1>
      <p className="mt-4">
        {game ? `${game.name} (appid ${game.steamAppId})` : "No games found"}
      </p>
    </main>
  );
}