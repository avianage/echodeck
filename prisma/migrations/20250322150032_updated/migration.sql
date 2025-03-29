/*
  Warnings:

  - You are about to drop the column `stremId` on the `Upvote` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,streamId]` on the table `Upvote` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `streamId` to the `Upvote` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Upvote" DROP CONSTRAINT "Upvote_stremId_fkey";

-- DropIndex
DROP INDEX "Upvote_userId_stremId_key";

-- AlterTable
ALTER TABLE "Upvote" DROP COLUMN "stremId",
ADD COLUMN     "streamId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Upvote_userId_streamId_key" ON "Upvote"("userId", "streamId");

-- AddForeignKey
ALTER TABLE "Upvote" ADD CONSTRAINT "Upvote_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
