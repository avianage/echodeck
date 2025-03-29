/*
  Warnings:

  - You are about to drop the column `userID` on the `Stream` table. All the data in the column will be lost.
  - You are about to drop the column `stremID` on the `Upvote` table. All the data in the column will be lost.
  - You are about to drop the column `userID` on the `Upvote` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,stremId]` on the table `Upvote` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Stream` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stremId` to the `Upvote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Upvote` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Stream" DROP CONSTRAINT "Stream_userID_fkey";

-- DropForeignKey
ALTER TABLE "Upvote" DROP CONSTRAINT "Upvote_stremID_fkey";

-- DropForeignKey
ALTER TABLE "Upvote" DROP CONSTRAINT "Upvote_userID_fkey";

-- DropIndex
DROP INDEX "Upvote_userID_stremID_key";

-- AlterTable
ALTER TABLE "Stream" DROP COLUMN "userID",
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Upvote" DROP COLUMN "stremID",
DROP COLUMN "userID",
ADD COLUMN     "stremId" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Upvote_userId_stremId_key" ON "Upvote"("userId", "stremId");

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upvote" ADD CONSTRAINT "Upvote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upvote" ADD CONSTRAINT "Upvote_stremId_fkey" FOREIGN KEY ("stremId") REFERENCES "Stream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
