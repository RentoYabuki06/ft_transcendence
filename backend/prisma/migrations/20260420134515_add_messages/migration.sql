-- CreateTable
CREATE TABLE "Messages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "senderId" INTEGER NOT NULL,
    "receiverId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Messages_senderId_receiverId_createdAt_idx" ON "Messages"("senderId", "receiverId", "createdAt");

-- CreateIndex
CREATE INDEX "Messages_receiverId_senderId_createdAt_idx" ON "Messages"("receiverId", "senderId", "createdAt");
