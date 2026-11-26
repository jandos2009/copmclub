-- CreateTable
CREATE TABLE "Club" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'economy',
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "hours" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hall" (
    "id" SERIAL NOT NULL,
    "clubId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 16,
    "height" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "Hall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seat" (
    "id" SERIAL NOT NULL,
    "clubId" INTEGER NOT NULL,
    "hallId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "zone" TEXT NOT NULL DEFAULT 'standard',
    "status" TEXT NOT NULL DEFAULT 'free',
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "login" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "clubId" INTEGER,
    "agreedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "clubId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "groupId" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSeat" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "seatId" INTEGER NOT NULL,

    CONSTRAINT "BookingSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" SERIAL NOT NULL,
    "clubId" INTEGER NOT NULL,
    "zone" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" SERIAL NOT NULL,
    "clubId" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Напитки',
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" SERIAL NOT NULL,
    "clubId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "start" TIMESTAMP(3) NOT NULL,
    "entryFee" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Club_slug_key" ON "Club"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Hall_clubId_name_key" ON "Hall"("clubId", "name");

-- CreateIndex
CREATE INDEX "Seat_clubId_hallId_idx" ON "Seat"("clubId", "hallId");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_clubId_name_key" ON "Seat"("clubId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE INDEX "User_clubId_idx" ON "User"("clubId");

-- CreateIndex
CREATE INDEX "Booking_clubId_start_idx" ON "Booking"("clubId", "start");

-- CreateIndex
CREATE INDEX "Booking_userId_start_idx" ON "Booking"("userId", "start");

-- CreateIndex
CREATE INDEX "Booking_groupId_idx" ON "Booking"("groupId");

-- CreateIndex
CREATE INDEX "BookingSeat_seatId_idx" ON "BookingSeat"("seatId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSeat_seatId_bookingId_key" ON "BookingSeat"("seatId", "bookingId");

-- CreateIndex
CREATE INDEX "PriceHistory_clubId_zone_validFrom_idx" ON "PriceHistory"("clubId", "zone", "validFrom");

-- CreateIndex
CREATE INDEX "MenuItem_clubId_category_idx" ON "MenuItem"("clubId", "category");

-- CreateIndex
CREATE INDEX "Tournament_clubId_start_idx" ON "Tournament"("clubId", "start");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- AddForeignKey
ALTER TABLE "Hall" ADD CONSTRAINT "Hall_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "Hall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
