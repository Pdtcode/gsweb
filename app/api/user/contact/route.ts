import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaClient";

export async function PUT(request: NextRequest) {
  try {
    const { userId, phoneNumber, instagramHandle } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User ID is required" },
        { status: 400 }
      );
    }

    // Update user contact information
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        phoneNumber: phoneNumber || null,
        instagramHandle: instagramHandle || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        instagramHandle: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: "Contact information updated successfully",
    });
  } catch (error) {
    console.error("Error updating contact information:", error);

    if (error instanceof Error && error.message.includes("Record to update not found")) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to update contact information" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User ID is required" },
        { status: 400 }
      );
    }

    // Get user contact information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        instagramHandle: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

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