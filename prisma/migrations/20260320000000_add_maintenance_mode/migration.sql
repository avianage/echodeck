CREATE TABLE "MaintenanceMode" (
    "id"        TEXT NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT false,
    "message"   TEXT,
    "startedAt" TIMESTAMP(3),
    "endsAt"    TIMESTAMP(3),
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceMode_pkey" PRIMARY KEY ("id")
);
