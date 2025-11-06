-- CreateEnum
CREATE TYPE "VoteResult" AS ENUM ('FAVOR', 'AGAINST', 'ABSTAIN', 'ABSENT');

-- CreateTable
CREATE TABLE "AssemblyMember" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "engName" TEXT,
    "party" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "committee" TEXT,
    "termNumber" INTEGER NOT NULL,
    "reelection" BOOLEAN NOT NULL DEFAULT false,
    "profileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssemblyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" SERIAL NOT NULL,
    "billId" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "billName" TEXT NOT NULL,
    "proposer" TEXT,
    "voteDate" TIMESTAMP(3) NOT NULL,
    "sessionNumber" INTEGER,
    "isPassed" BOOLEAN NOT NULL,
    "favorCount" INTEGER,
    "againstCount" INTEGER,
    "abstainCount" INTEGER,
    "absentCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "billId" INTEGER NOT NULL,
    "result" "VoteResult" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssemblyMember_memberId_key" ON "AssemblyMember"("memberId");

-- CreateIndex
CREATE INDEX "AssemblyMember_name_idx" ON "AssemblyMember"("name");

-- CreateIndex
CREATE INDEX "AssemblyMember_party_idx" ON "AssemblyMember"("party");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_billId_key" ON "Bill"("billId");

-- CreateIndex
CREATE INDEX "Bill_voteDate_idx" ON "Bill"("voteDate");

-- CreateIndex
CREATE INDEX "Bill_billName_idx" ON "Bill"("billName");

-- CreateIndex
CREATE INDEX "Vote_memberId_idx" ON "Vote"("memberId");

-- CreateIndex
CREATE INDEX "Vote_billId_idx" ON "Vote"("billId");

-- CreateIndex
CREATE INDEX "Vote_result_idx" ON "Vote"("result");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_memberId_billId_key" ON "Vote"("memberId", "billId");

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "AssemblyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
