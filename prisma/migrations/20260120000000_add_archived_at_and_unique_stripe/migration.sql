-- AlterTable
ALTER TABLE "Order" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripePaymentIntentId_key" ON "Order"("stripePaymentIntentId");
