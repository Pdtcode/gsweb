import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prismaClient";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: addressId } = params;

    if (!addressId) {
      return NextResponse.json(
        { error: "Address ID is required" },
        { status: 400 },
      );
    }

    // Get the authorization token from the header
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];

    // Verify the Firebase token
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const { uid } = decodedToken;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: {
        firebaseUid: uid,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify the address belongs to this user
    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId: user.id,
      },
    });

    if (!address) {
      return NextResponse.json(
        { error: "Address not found or does not belong to user" },
        { status: 404 },
      );
    }

    // Use a transaction to ensure only one default address exists
    await prisma.$transaction(async (tx) => {
      // First, set all user's addresses to not default
      await tx.address.updateMany({
        where: {
          userId: user.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });

      // Then set the specified address as default
      await tx.address.update({
        where: {
          id: addressId,
        },
        data: {
          isDefault: true,
        },
      });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error setting default address:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}