import { NextRequest, NextResponse } from "next/server";
import { getOrderByPaymentIntentId } from "@/app/actions/orderActions";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentIntentId = searchParams.get("payment_intent");

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "Payment intent ID is required" },
        { status: 400 }
      );
    }

    // Remove the "pi_" prefix if present and any additional parameters
    const cleanPaymentIntentId = paymentIntentId.split("_secret_")[0];

    const order = await getOrderByPaymentIntentId(cleanPaymentIntentId);

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Error fetching order by payment intent:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}