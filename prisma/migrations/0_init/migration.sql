-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "CalendarLink" (
    "uuid" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarLink_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "CalendarGrant" (
    "studentId" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "pendingSince" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),

    CONSTRAINT "CalendarGrant_pkey" PRIMARY KEY ("studentId")
);

-- CreateTable
CREATE TABLE "SyncedEvent" (
    "studentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,

    CONSTRAINT "SyncedEvent_pkey" PRIMARY KEY ("studentId","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarLink_studentId_key" ON "CalendarLink"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarGrant_googleSub_key" ON "CalendarGrant"("googleSub");

-- CreateIndex
CREATE INDEX "CalendarGrant_pendingSince_idx" ON "CalendarGrant"("pendingSince");

