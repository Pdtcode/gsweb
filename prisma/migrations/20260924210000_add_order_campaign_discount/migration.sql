-- Spend & Save campaign discount applied to the order (null when none)
ALTER TABLE "Order" ADD COLUMN "campaignDiscount" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN "campaignName" TEXT;
