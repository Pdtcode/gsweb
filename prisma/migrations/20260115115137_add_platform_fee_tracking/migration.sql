-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "connectedAccountId" TEXT,
ADD COLUMN     "platformFeeAmount" DECIMAL(10,2);
