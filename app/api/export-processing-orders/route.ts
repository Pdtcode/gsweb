import { NextResponse } from "next/server";
import { createClient } from "@sanity/client";

const sanityClient = createClient({
  projectId: "arbp7h2s",
  dataset: "production",
  useCdn: false,
  apiVersion: "2023-05-03",
  token: process.env.SANITY_API_TOKEN,
});

export async function GET() {
  try {
    // Fetch all orders with PROCESSING status from Sanity
    const processingOrders = await sanityClient.fetch(`
      *[_type == "order" && status == "PROCESSING"] | order(createdAt desc) {
        _id,
        orderNumber,
        customerName,
        customerEmail,
        shippingAddress,
        total,
        createdAt,
        items[] {
          name,
          quantity,
          price
        }
      }
    `);

    if (processingOrders.length === 0) {
      return NextResponse.json(
        { message: "No processing orders found" },
        { status: 404 }
      );
    }

    // Convert to CSV format
    const csvHeaders = [
      "Order Number",
      "Customer Name", 
      "Customer Email",
      "Shipping Name",
      "Street Address",
      "City",
      "State",
      "Postal Code",
      "Country",
      "Order Total",
      "Items",
      "Order Date"
    ];

    const csvRows = processingOrders.map((order: any) => {
      // Format items as a simple string
      const itemsString = order.items
        ?.map((item: any) => `${item.quantity}x ${item.name} ($${item.price})`)
        .join("; ") || "No items";

      // Format date
      const orderDate = new Date(order.createdAt).toLocaleDateString();

      return [
        order.orderNumber || "",
        order.customerName || "",
        order.customerEmail || "",
        order.shippingAddress?.name || order.customerName || "",
        order.shippingAddress?.street || "",
        order.shippingAddress?.city || "",
        order.shippingAddress?.state || "",
        order.shippingAddress?.postalCode || "",
        order.shippingAddress?.country || "United States",
        `$${order.total?.toFixed(2) || "0.00"}`,
        `"${itemsString}"`, // Wrap in quotes to handle commas in item descriptions
        orderDate
      ];
    });

    // Combine headers and rows
    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.join(","))
      .join("\n");

    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0];
    const filename = `processing-orders-${today}.csv`;

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (error) {
    console.error("Error exporting processing orders:", error);
    return NextResponse.json(
      { 
        error: "Export failed", 
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}