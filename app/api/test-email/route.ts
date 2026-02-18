import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/services/email-service";
import { orderEventEmitter } from "@/lib/events/order-events";

export async function POST(request: NextRequest) {
  try {
    const { testType, email } = await request.json();

    if (!email || !testType) {
      return NextResponse.json(
        { error: "Email and test type are required" },
        { status: 400 }
      );
    }

    switch (testType) {
      case "connection": {
        console.log("🔧 Testing email service connection...");
        const isConnected = await emailService.testEmailConnection();

        return NextResponse.json({
          success: isConnected,
          message: isConnected
            ? "Email service connection successful"
            : "Email service connection failed",
          timestamp: new Date().toISOString()
        });
      }

      case "simple": {
        console.log(`📧 Sending test email to ${email}...`);
        const sent = await emailService.sendTestEmail(email);

        return NextResponse.json({
          success: sent,
          message: sent
            ? "Test email sent successfully"
            : "Failed to send test email",
          recipient: email,
          timestamp: new Date().toISOString()
        });
      }

      case "order-confirmation": {
        console.log(`📧 Testing order confirmation email flow for ${email}...`);

        // Create a mock order confirmation event
        const mockOrderEvent = {
          orderId: "test_order_123",
          orderNumber: `TEST-${Date.now()}`,
          customerEmail: email,
          customerName: "Test Customer",
          total: 125.99,
          items: [
            {
              name: "Test Product - Year of the Snake Tee",
              quantity: 1,
              price: 49.99,
              variantInfo: "Size: L, Color: Black"
            },
            {
              name: "Limited Edition Cap",
              quantity: 2,
              price: 29.99
            }
          ],
          deliveryMethod: null,
          pickupLocationName: null,
          shippingAddress: "123 Test Street",
          shippingApartment: null,
          shippingCity: "Test City",
          shippingState: "TS",
          shippingZipCode: "12345",
          shippingCountry: "United States",
          paymentIntentId: "pi_test_12345",
          serviceFee: {
            baseAmount: 5.50,
            discount: 5.50,
            finalAmount: 0.00
          },
          discount: {
            code: "TESTCODE",
            amount: 10.00
          },
          createdAt: new Date().toISOString()
        };

        try {
          await orderEventEmitter.emitOrderConfirmed(mockOrderEvent);

          return NextResponse.json({
            success: true,
            message: "Order confirmation email test initiated",
            orderNumber: mockOrderEvent.orderNumber,
            recipient: email,
            timestamp: new Date().toISOString(),
            note: "Check your email for the order confirmation. Check server logs for detailed status."
          });
        } catch (error) {
          console.error("Error testing order confirmation flow:", error);
          return NextResponse.json({
            success: false,
            message: "Failed to test order confirmation flow",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString()
          });
        }
      }

      default: {
        return NextResponse.json(
          { error: "Invalid test type. Use 'connection', 'simple', or 'order-confirmation'" },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error("Email test error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Health check endpoint
  const isReady = emailService.isReady();

  return NextResponse.json({
    status: "Email Service Status",
    ready: isReady,
    timestamp: new Date().toISOString(),
    availableTests: [
      {
        type: "connection",
        description: "Test Gmail API connection",
        method: "POST",
        body: { testType: "connection", email: "your@email.com" }
      },
      {
        type: "simple",
        description: "Send a simple test email",
        method: "POST",
        body: { testType: "simple", email: "your@email.com" }
      },
      {
        type: "order-confirmation",
        description: "Test complete order confirmation flow",
        method: "POST",
        body: { testType: "order-confirmation", email: "your@email.com" }
      }
    ]
  });
}