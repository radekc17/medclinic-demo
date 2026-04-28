/*
  Warnings:

  - A unique constraint covering the columns `[confirmationToken]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "confirmationSentAt" TIMESTAMP(3),
ADD COLUMN     "confirmationToken" TEXT,
ADD COLUMN     "emailSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastContactAttempt" TIMESTAMP(3),
ADD COLUMN     "manualCheckRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsSent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "clinicId" INTEGER,
ADD COLUMN     "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "clinicId" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clinicId" INTEGER;

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "longTermSmsHours" INTEGER NOT NULL DEFAULT 48,
    "shortTermSmsHours" INTEGER NOT NULL DEFAULT 2,
    "lastMinuteLimitHours" INTEGER NOT NULL DEFAULT 2,
    "skipManualVerification" BOOLEAN NOT NULL DEFAULT false,
    "isTvModuleActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_confirmationToken_key" ON "Appointment"("confirmationToken");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
