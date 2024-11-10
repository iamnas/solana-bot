-- CreateEnum
CREATE TYPE "MEVMODE" AS ENUM ('Turbo', 'Secure');

-- CreateEnum
CREATE TYPE "TX_PRIORITY" AS ENUM ('High', 'VaryHigh', 'Medium', 'Custom');

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'English',
    "minPosValue" DOUBLE PRECISION NOT NULL DEFAULT 0.001,
    "autoBuyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoBuyAmount" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoApproveDisabled" BOOLEAN NOT NULL DEFAULT false,
    "buyLeftButtonAmount" DOUBLE PRECISION DEFAULT 1.0,
    "buyRightButtonAmount" DOUBLE PRECISION DEFAULT 5.0,
    "sellLeftButtonPercentage" INTEGER DEFAULT 25,
    "sellRightButtonPercentage" INTEGER DEFAULT 100,
    "buySlippagePercentage" INTEGER NOT NULL DEFAULT 10,
    "sellSlippagePercentage" INTEGER NOT NULL DEFAULT 10,
    "maxPriceImpact" INTEGER NOT NULL DEFAULT 25,
    "mevProtectEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mevMode" "MEVMODE" NOT NULL DEFAULT 'Turbo',
    "transactionPriority" "TX_PRIORITY" NOT NULL DEFAULT 'Medium',
    "transactionFee" DOUBLE PRECISION NOT NULL DEFAULT 0.001,
    "sellProtectionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setting_id_key" ON "Setting"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_userId_key" ON "Setting"("userId");

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
