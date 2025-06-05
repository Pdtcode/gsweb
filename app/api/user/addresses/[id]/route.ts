/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prismaClient";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: addressId } = params;

    if (!addressId) {
      return NextResponse.json(
        { error: "Address ID is required" },
        { status: 400 },
      );
    }

    const address = await prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    return NextResponse.json(address);
  } catch (error) {
    console.error("Error fetching address:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

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

    // Get address data from request body
    const data = await request.json();
    const { street, city, state, postalCode, country, isDefault } = data;

    // Validate required fields
    if (!street || !city || !state || !postalCode || !country) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 },
      );
    }

    // Verify the address belongs to this user
    const existingAddress = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId: user.id,
      },
    });

    if (!existingAddress) {
      return NextResponse.json(
        { error: "Address not found or does not belong to user" },
        { status: 404 },
      );
    }

    // If this address is being set as default, update other addresses
    if (isDefault) {
      await prisma.address.updateMany({
        where: {
          userId: user.id,
          isDefault: true,
          id: { not: addressId },
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Update the address
    const updatedAddress = await prisma.address.update({
      where: { id: addressId },
      data: {
        street,
        city,
        state,
        postalCode,
        country,
        isDefault: !!isDefault,
      },
    });

    return NextResponse.json(updatedAddress, { status: 200 });
  } catch (error) {
    console.error("Error updating address:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Delete the address
    await prisma.address.delete({
      where: { id: addressId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting address:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
