import { NextRequest, NextResponse } from "next/server";
import { auth } from "firebase-admin";

import prisma from "@/lib/prismaClient";
import { getFirebaseAdminApp } from "@/lib/firebaseAdmin";

// Firebase Admin will be lazily initialized when getFirebaseAdminApp() is called

export async function POST(request: NextRequest) {
  try {
    // Ensure Firebase Admin is initialized
    await getFirebaseAdminApp();

    // Get the authorization token from the header
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];

    // Verify the Firebase token
    const decodedToken = await auth().verifyIdToken(token);
    const { uid, email, name, email_verified } = decodedToken;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if user already exists in database
    let user = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (user) {
      // An existing row is usually a guest created at checkout, with that
      // customer's orders. Only a login whose email Firebase has verified may
      // claim it: email/password sign-up does not verify, so otherwise anyone
      // could sign up with a customer's address and inherit their orders.
      const claimable =
        user.firebaseUid === uid || (!user.firebaseUid && email_verified);

      if (!claimable) {
        return NextResponse.json(
          { error: "Verify your email address to link your previous orders" },
          { status: 403 },
        );
      }

      // If user exists but doesn't have Firebase UID, update it
      if (!user.firebaseUid) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { firebaseUid: uid },
        });
      }
    } else {
      // Create new user with Firebase UID
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split("@")[0], // Use part of email as name if not provided
          firebaseUid: uid,
        },
      });
    }

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error creating/syncing user:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Ensure Firebase Admin is initialized
    await getFirebaseAdminApp();

    // Get the authorization token from the header
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];

    // Verify the Firebase token
    const decodedToken = await auth().verifyIdToken(token);
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

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error getting user:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
