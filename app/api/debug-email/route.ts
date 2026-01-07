import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  console.log("🔍 Email Debug - Starting diagnostic...");

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasGoogleProjectId: !!process.env.GOOGLE_PROJECT_ID,
      hasServiceAccountEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      hasPrivateKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
      hasEmailFromAddress: !!process.env.EMAIL_FROM_ADDRESS,
      projectId: process.env.GOOGLE_PROJECT_ID,
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      emailFromAddress: process.env.EMAIL_FROM_ADDRESS,
      privateKeyFormat: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.substring(0, 50) + "...",
    },
    emailServiceStatus: "checking...",
    gmailApiTest: "checking...",
  };

  try {
    // Test email service import
    console.log("🔍 Testing email service import...");
    const { emailService } = await import("@/lib/services/email-service");
    diagnostics.emailServiceStatus = emailService.isReady() ? "initialized" : "not ready";
    console.log(`✅ Email service status: ${diagnostics.emailServiceStatus}`);

    // Test Gmail API connection
    console.log("🔍 Testing Gmail API connection...");
    const isConnected = await emailService.testEmailConnection();
    diagnostics.gmailApiTest = isConnected ? "connected" : "failed";
    console.log(`✅ Gmail API test: ${diagnostics.gmailApiTest}`);

  } catch (error) {
    console.error("❌ Error during diagnostics:", error);
    diagnostics.emailServiceStatus = `error: ${error instanceof Error ? error.message : 'unknown'}`;
  }

  return NextResponse.json(diagnostics, { status: 200 });
}

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json(
      { error: "Email address is required" },
      { status: 400 }
    );
  }

  console.log(`🔍 Testing email send to: ${email}`);

  try {
    // Import and test email service
    const { emailService } = await import("@/lib/services/email-service");
    const { orderEventEmitter } = await import("@/lib/events/order-events");

    // Test 1: Simple email
    console.log("📧 Test 1: Sending simple test email...");
    const simpleResult = await emailService.sendTestEmail(email);

    // Test 2: Order confirmation event
    console.log("📧 Test 2: Emitting order confirmation event...");
    await orderEventEmitter.emitOrderConfirmed({
      orderId: "debug_test_123",
      orderNumber: `DEBUG-${Date.now()}`,
      customerEmail: email,
      customerName: "Debug Test User",
      total: 89.99,
      items: [
        {
          name: "Debug Test Product",
          quantity: 1,
          price: 79.99,
          variantInfo: "Size: M, Color: Black"
        }
      ],
      shippingAddress: "123 Debug Street, Test City, TC 12345, USA",
      paymentIntentId: "pi_debug_test",
      serviceFee: {
        baseAmount: 4.00,
        discount: 0,
        finalAmount: 4.00
      },
      discount: {
        code: "DEBUG10",
        amount: 8.00
      },
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      simpleEmailResult: simpleResult,
      orderConfirmationEventEmitted: true,
      message: "Check your email and server logs for results",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Debug email test failed:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
}