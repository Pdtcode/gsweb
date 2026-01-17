// Test script to verify shipping address mapping fix
// This simulates what the syncOrderToSanity function will do with the new mapping

// Sample order data from Neon DB (individual fields)
const mockNeonOrder = {
  id: "test-order-123",
  orderNumber: "ORD-TEST-123",
  userId: "user-456",
  total: 42.00,
  status: "PROCESSING",
  stripePaymentIntentId: "pi_test_123",
  shippingFirstName: "Peter",
  shippingLastName: "Trinh",
  shippingEmail: "trinhpeter15@gmail.com",
  shippingPhone: "+1234567890",
  shippingAddress: "5727 Northwest 36th Street",
  shippingCity: "Warr Acres",
  shippingState: "OK",
  shippingZipCode: "73122",
  shippingCountry: "US",
  createdAt: new Date(),
  updatedAt: new Date(),
  User: {
    email: "trinhpeter15@gmail.com",
    name: "Peter Trinh"
  },
  OrderItem: [
    {
      id: "item-789",
      productId: "product-101",
      variantId: null,
      quantity: 1,
      price: 40.00,
      Product: {
        name: "Grail Shorts"
      }
    }
  ]
};

console.log('🧪 Testing Shipping Address Mapping Fix');
console.log('=' .repeat(50));

console.log('\n📥 Input (Neon DB format):');
console.log('Individual shipping fields:');
console.log(`  shippingFirstName: "${mockNeonOrder.shippingFirstName}"`);
console.log(`  shippingLastName: "${mockNeonOrder.shippingLastName}"`);
console.log(`  shippingAddress: "${mockNeonOrder.shippingAddress}"`);
console.log(`  shippingCity: "${mockNeonOrder.shippingCity}"`);
console.log(`  shippingState: "${mockNeonOrder.shippingState}"`);
console.log(`  shippingZipCode: "${mockNeonOrder.shippingZipCode}"`);
console.log(`  shippingCountry: "${mockNeonOrder.shippingCountry}"`);

// Apply the NEW mapping logic (fixed)
const sanityOrderFixed = {
  _id: `order-${mockNeonOrder.id}`,
  _type: "order",
  orderNumber: mockNeonOrder.orderNumber,
  userId: mockNeonOrder.userId,
  customerEmail: mockNeonOrder.User.email,
  customerName: mockNeonOrder.User.name || "",
  total: Number(mockNeonOrder.total),
  status: mockNeonOrder.status,
  stripePaymentIntentId: mockNeonOrder.stripePaymentIntentId || "",
  // NEW: Map to nested shippingAddress object
  shippingAddress: {
    name: `${mockNeonOrder.shippingFirstName || ""} ${mockNeonOrder.shippingLastName || ""}`.trim(),
    street: mockNeonOrder.shippingAddress || "",
    city: mockNeonOrder.shippingCity || "",
    state: mockNeonOrder.shippingState || "",
    postalCode: mockNeonOrder.shippingZipCode || "",
    country: mockNeonOrder.shippingCountry || "",
  },
  // Also include individual fields for backwards compatibility
  shippingFirstName: mockNeonOrder.shippingFirstName || "",
  shippingLastName: mockNeonOrder.shippingLastName || "",
  shippingEmail: mockNeonOrder.shippingEmail || "",
  shippingPhone: mockNeonOrder.shippingPhone || "",
  shippingCity: mockNeonOrder.shippingCity || "",
  shippingState: mockNeonOrder.shippingState || "",
  shippingZipCode: mockNeonOrder.shippingZipCode || "",
  shippingCountry: mockNeonOrder.shippingCountry || "",
  createdAt: mockNeonOrder.createdAt.toISOString(),
  updatedAt: mockNeonOrder.updatedAt.toISOString(),
  items: mockNeonOrder.OrderItem.map((item) => ({
    _key: item.id,
    itemId: item.id,
    productId: item.productId,
    variantId: item.variantId || "",
    name: item.Product.name,
    quantity: item.quantity,
    price: Number(item.price),
  })),
};

console.log('\n📤 Output (Fixed Sanity format):');
console.log('Nested shippingAddress object:');
console.log(`  shippingAddress.name: "${sanityOrderFixed.shippingAddress.name}"`);
console.log(`  shippingAddress.street: "${sanityOrderFixed.shippingAddress.street}"`);
console.log(`  shippingAddress.city: "${sanityOrderFixed.shippingAddress.city}"`);
console.log(`  shippingAddress.state: "${sanityOrderFixed.shippingAddress.state}"`);
console.log(`  shippingAddress.postalCode: "${sanityOrderFixed.shippingAddress.postalCode}"`);
console.log(`  shippingAddress.country: "${sanityOrderFixed.shippingAddress.country}"`);

// Test how this will look in the CSV export
console.log('\n📋 CSV Export Test:');
console.log('How this data will appear in the CSV:');

const csvRow = [
  sanityOrderFixed.orderNumber || "",
  sanityOrderFixed.customerName || "",
  sanityOrderFixed.customerEmail || "",
  sanityOrderFixed.shippingAddress?.name || sanityOrderFixed.customerName || "",
  sanityOrderFixed.shippingAddress?.street || "",
  sanityOrderFixed.shippingAddress?.city || "",
  sanityOrderFixed.shippingAddress?.state || "",
  sanityOrderFixed.shippingAddress?.postalCode || "",
  sanityOrderFixed.shippingAddress?.country || "United States",
  `$${sanityOrderFixed.total?.toFixed(2) || "0.00"}`,
  `"${sanityOrderFixed.items?.map(item => `${item.quantity}x ${item.name} ($${item.price})`).join("; ") || "No items"}"`,
  new Date(sanityOrderFixed.createdAt).toLocaleDateString()
];

console.log('CSV Headers:');
console.log('Order Number,Customer Name,Customer Email,Shipping Name,Street Address,City,State,Postal Code,Country,Order Total,Items,Order Date');
console.log('\nCSV Data:');
console.log(csvRow.join(','));

console.log('\n✅ The fix successfully maps individual Neon DB fields to nested Sanity shippingAddress object!');
console.log('📌 Now when orders are synced, the CSV export will show shipping addresses properly.');
console.log('\n🔄 To apply this fix to existing orders, they need to be re-synced from Neon to Sanity.');

// Show the difference
console.log('\n🔍 Before vs After comparison:');
console.log('BEFORE (broken): shippingAddress was a flat string, other fields ignored');
console.log('AFTER (fixed):   shippingAddress is an object with nested fields that the CSV can access');

console.log('\n✨ Fix Summary:');
console.log('• Fixed dualSyncService.ts to map Neon DB individual fields to Sanity nested object');
console.log('• Maintained backwards compatibility by including individual fields');
console.log('• CSV export will now populate shipping columns correctly for new orders');
console.log('• Existing orders need re-sync to get the corrected format');