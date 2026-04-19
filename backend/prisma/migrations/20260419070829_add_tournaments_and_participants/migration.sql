/*
  Warnings:

  - Added the required column `createdBy` to the `Tournaments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Tournaments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "TournamentParticipants" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tournamentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Games" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "statusId" INTEGER NOT NULL,
    "tournamentId" INTEGER,
    "round" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 1,
    "playerNum" INTEGER NOT NULL DEFAULT 2,
    "gameTypeId" INTEGER NOT NULL,
    "winnerId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Games" ("createdAt", "gameTypeId", "id", "order", "playerNum", "round", "statusId", "tournamentId", "updatedAt", "winnerId") SELECT "createdAt", "gameTypeId", "id", "order", "playerNum", "round", "statusId", "tournamentId", "updatedAt", "winnerId" FROM "Games";
DROP TABLE "Games";
ALTER TABLE "new_Games" RENAME TO "Games";
CREATE TABLE "new_Tournaments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "statusId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "maxParticipants" INTEGER NOT NULL DEFAULT 8,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Tournaments" ("createdAt", "id", "statusId", "updatedAt") SELECT "createdAt", "id", "statusId", "updatedAt" FROM "Tournaments";
DROP TABLE "Tournaments";
ALTER TABLE "new_Tournaments" RENAME TO "Tournaments";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TournamentParticipants_tournamentId_userId_key" ON "TournamentParticipants"("tournamentId", "userId");
