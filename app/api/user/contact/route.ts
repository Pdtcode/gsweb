import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaClient";
import { findUserForToken, verifyFirebaseRequest } from "@/lib/auth/verify-request";

const CONTACT_FIELDS = {
  id: true,
  email: true,
  name: true,
  phoneNumber: true,
  instagramHandle: true,
} as const;

// Both handlers act on the signed-in user from the verified token. They used to
// take a userId from the request, which let anyone read or overwrite any
// customer's contact details.

export async function PUT(request: NextRequest) {
  try {
    const token = await verifyFirebaseRequest(request);

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await findUserForToken(token);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    const { phoneNumber, instagramHandle } = await request.json();

    // Update user contact information
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        phoneNumber: phoneNumber || null,
        instagramHandle: instagramHandle || null,
      },
      select: CONTACT_FIELDS,
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: "Contact information updated successfully",
    });
  } catch (error) {
    console.error("Error updating contact information:", error);

    return NextResponse.json(
      { success: false, message: "Failed to update contact information" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = await verifyFirebaseRequest(request);

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const found = await findUserForToken(token);

    if (!found) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // Get user contact information
    const user = await prisma.user.findUnique({
      where: { id: found.id },
      select: CONTACT_FIELDS,
    });

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Error fetching contact information:", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch contact information" },
      { status: 500 }
    );
  }
}
