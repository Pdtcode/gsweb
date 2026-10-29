import { NextRequest, NextResponse } from "next/server";

import { getUserOrders } from "@/app/actions/orderActions";
import { findUserForToken, verifyFirebaseRequest } from "@/lib/auth/verify-request";

export async function GET(request: NextRequest) {
  try {
    // The customer is identified by their verified login token only. This
    // route used to trust an ?email= parameter, which let anyone read any
    // customer's orders (name, phone, address) by typing their email.
    const token = await verifyFirebaseRequest(request);

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserForToken(token);

    // No orders yet, or an unverified email that can't claim guest orders
    if (!user) {
      return NextResponse.json({ orders: [] });
    }

    // Get ONLY this user's orders
    const orders = await getUserOrders(user.id);

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Error fetching user orders:", error);

    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 },
    );
  }
}
