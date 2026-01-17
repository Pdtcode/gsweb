import { NextResponse } from "next/server";
import prisma from "@/lib/prismaClient";

export async function GET() {
  try {
    // Get recent webhook logs
    const webhookLogs = await prisma.webhookLog.findMany({
      orderBy: { processedAt: 'desc' },
      take: 10,
      include: {
        Order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
          }
        }
      }
    });

    // Get recent orders
    const recentOrders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        OrderItem: {
          include: {
            Product: {
              select: { name: true }
            },
            ProductVariant: {
              select: { sku: true, stock: true }
            }
          }
        }
      }
    });

    return NextResponse.json({
      webhookLogs,
      recentOrders,
      totalWebhookLogs: await prisma.webhookLog.count(),
      totalOrders: await prisma.order.count(),
    });
  } catch (error) {
    console.error("Error fetching webhook logs:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch webhook logs",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}