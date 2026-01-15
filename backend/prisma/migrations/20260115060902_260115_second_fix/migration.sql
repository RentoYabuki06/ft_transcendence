/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `WaitingRooms` will be added. If there are existing duplicate values, this will fail.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Games" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "statusId" INTEGER NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "playerNum" INTEGER NOT NULL,
    "gameTypeId" INTEGER NOT NULL,
    "winnerId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Games" ("createdAt", "gameTypeId", "id", "order", "playerNum", "round", "statusId", "tournamentId", "updatedAt", "winnerId") SELECT "createdAt", "gameTypeId", "id", "order", "playerNum", "round", "statusId", "tournamentId", "updatedAt", "winnerId" FROM "Games";
DROP TABLE "Games";
ALTER TABLE "new_Games" RENAME TO "Games";
CREATE TABLE "new_PlayerScores" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "statusId" INTEGER NOT NULL,
    "gameId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_PlayerScores" ("createdAt", "gameId", "id", "score", "statusId", "updatedAt", "userId") SELECT "createdAt", "gameId", "id", "score", "statusId", "updatedAt", "userId" FROM "PlayerScores";
DROP TABLE "PlayerScores";
ALTER TABLE "new_PlayerScores" RENAME TO "PlayerScores";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WaitingRooms_name_key" ON "WaitingRooms"("name");
