-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('NEVER', 'OK', 'PRIVATE_PROFILE', 'FAILED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('MATCHED', 'NO_IGDB_MATCH', 'FILTERED_NON_GAME');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('STEAM');

-- CreateEnum
CREATE TYPE "Bucket" AS ENUM ('FINISH_TONIGHT', 'GOOD_PROGRESS', 'NO_COMMITMENT');

-- CreateEnum
CREATE TYPE "TimeBracket" AS ENUM ('HALF_HOUR', 'HOUR_OR_TWO', 'LONG_EVENING', 'NOT_SURE');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "steamId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "importStatus" "ImportStatus" NOT NULL DEFAULT 'NEVER',
    "lastImportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IgdbGame" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "hastilySeconds" INTEGER,
    "normallySeconds" INTEGER,
    "completelySeconds" INTEGER,
    "sampleCount" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgdbGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" SERIAL NOT NULL,
    "steamAppId" INTEGER,
    "name" TEXT NOT NULL,
    "matchStatus" "MatchStatus" NOT NULL,
    "igdbGameId" INTEGER,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGame" (
    "userId" INTEGER NOT NULL,
    "gameId" INTEGER NOT NULL,
    "platform" "Platform" NOT NULL DEFAULT 'STEAM',
    "playtimeMinutes" INTEGER NOT NULL,
    "playtime2WeeksMinutes" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" TIMESTAMP(3),
    "userMarkedFinished" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGame_pkey" PRIMARY KEY ("userId","gameId","platform")
);

-- CreateTable
CREATE TABLE "PlaytimeSnapshot" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "gameId" INTEGER NOT NULL,
    "playtimeMinutes" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaytimeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "gameId" INTEGER NOT NULL,
    "bucket" "Bucket" NOT NULL,
    "timeBracket" "TimeBracket" NOT NULL,
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_steamId_key" ON "User"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_steamAppId_key" ON "Game"("steamAppId");

-- CreateIndex
CREATE INDEX "Game_igdbGameId_idx" ON "Game"("igdbGameId");

-- CreateIndex
CREATE INDEX "PlaytimeSnapshot_userId_gameId_takenAt_idx" ON "PlaytimeSnapshot"("userId", "gameId", "takenAt");

-- CreateIndex
CREATE INDEX "SuggestionLog_userId_timeBracket_shownAt_idx" ON "SuggestionLog"("userId", "timeBracket", "shownAt");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_igdbGameId_fkey" FOREIGN KEY ("igdbGameId") REFERENCES "IgdbGame"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGame" ADD CONSTRAINT "UserGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGame" ADD CONSTRAINT "UserGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaytimeSnapshot" ADD CONSTRAINT "PlaytimeSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaytimeSnapshot" ADD CONSTRAINT "PlaytimeSnapshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionLog" ADD CONSTRAINT "SuggestionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionLog" ADD CONSTRAINT "SuggestionLog_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
