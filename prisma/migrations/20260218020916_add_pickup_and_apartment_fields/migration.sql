-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryMethod" TEXT,
ADD COLUMN     "pickupLocationId" TEXT,
ADD COLUMN     "pickupLocationName" TEXT,
ADD COLUMN     "shippingApartment" TEXT;
