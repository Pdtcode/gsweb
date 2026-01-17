const { PrismaClient } = require('../lib/generated/prisma');
const prisma = new PrismaClient();

async function testShippingSync() {
  try {
    console.log('🔍 Finding orders with shipping addresses...');

    // Find orders that have shipping address information
    const ordersWithShipping = await prisma.order.findMany({
      where: {
        OR: [
          { shippingFirstName: { not: null } },
          { shippingLastName: { not: null } },
          { shippingAddress: { not: null } },
          { shippingCity: { not: null } },
          { shippingState: { not: null } },
          { shippingZipCode: { not: null } }
        ]
      },
      include: {
        User: {
          select: {
            email: true,
            name: true,
          },
        },
        OrderItem: {
          include: {
            Product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5 // Limit to 5 orders for testing
    });

    console.log(`📦 Found ${ordersWithShipping.length} orders with shipping information`);

    if (ordersWithShipping.length === 0) {
      console.log('ℹ️ No orders with shipping addresses found');
      return;
    }

    // Display sample order data
    for (const order of ordersWithShipping) {
      console.log(`\n--- Order ${order.orderNumber} ---`);
      console.log('Shipping Details:');
      console.log(`  Name: ${order.shippingFirstName || ''} ${order.shippingLastName || ''}`);
      console.log(`  Email: ${order.shippingEmail || 'N/A'}`);
      console.log(`  Address: ${order.shippingAddress || 'N/A'}`);
      console.log(`  City: ${order.shippingCity || 'N/A'}`);
      console.log(`  State: ${order.shippingState || 'N/A'}`);
      console.log(`  ZIP: ${order.shippingZipCode || 'N/A'}`);
      console.log(`  Country: ${order.shippingCountry || 'N/A'}`);

      // Test the API endpoint to re-sync this order
      console.log(`\n🔄 Testing re-sync for order ${order.id}...`);

      try {
        const response = await fetch('http://localhost:3001/api/sync-single-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ orderId: order.id })
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Successfully re-synced order ${order.orderNumber}`);
          console.log(`   Message: ${result.message}`);
        } else {
          const error = await response.text();
          console.log(`❌ Failed to re-sync order ${order.orderNumber}: ${error}`);
        }
      } catch (syncError) {
        console.log(`❌ Error calling sync API for order ${order.orderNumber}:`, syncError.message);
      }
    }

    console.log('\n✅ Testing completed');

  } catch (error) {
    console.error('❌ Error testing shipping sync:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testShippingSync().catch(console.error);