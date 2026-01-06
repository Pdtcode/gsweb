-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookLog_paymentIntentId_key" ON "WebhookLog"("paymentIntentId");

-- CreateIndex
CREATE INDEX "WebhookLog_paymentIntentId_idx" ON "WebhookLog"("paymentIntentId");
