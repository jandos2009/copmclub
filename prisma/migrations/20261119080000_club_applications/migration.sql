CREATE TABLE "ClubApplication" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "clubName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "clubId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ClubApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClubApplication_userId_idx" ON "ClubApplication"("userId");

CREATE INDEX "ClubApplication_status_idx" ON "ClubApplication"("status");

ALTER TABLE "ClubApplication" ADD CONSTRAINT "ClubApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClubApplication" ADD CONSTRAINT "ClubApplication_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
