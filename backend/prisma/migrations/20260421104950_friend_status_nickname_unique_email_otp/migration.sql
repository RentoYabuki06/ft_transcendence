/*
  Warnings:

  - You are about to drop the column `twoFactorSecret` on the `Users` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Friendships" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "friendId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- 既存データは移行時点で双方向に成立していたため accepted として移行
INSERT INTO "new_Friendships" ("createdAt", "friendId", "id", "userId", "status") SELECT "createdAt", "friendId", "id", "userId", 'accepted' FROM "Friendships";
DROP TABLE "Friendships";
ALTER TABLE "new_Friendships" RENAME TO "Friendships";
CREATE UNIQUE INDEX "Friendships_userId_friendId_key" ON "Friendships"("userId", "friendId");
CREATE TABLE "new_Users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "pictureURL" TEXT,
    "statusId" INTEGER NOT NULL,
    "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorCode" TEXT,
    "twoFactorCodeExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Users" ("createdAt", "email", "id", "isTwoFactorEnabled", "name", "nickname", "pictureURL", "statusId", "updatedAt") SELECT "createdAt", "email", "id", "isTwoFactorEnabled", "name", "nickname", "pictureURL", "statusId", "updatedAt" FROM "Users";
DROP TABLE "Users";
ALTER TABLE "new_Users" RENAME TO "Users";
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");
CREATE UNIQUE INDEX "Users_nickname_key" ON "Users"("nickname");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
