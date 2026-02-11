#!/usr/bin/env tsx
import * as path from 'path';
import { createClient } from '@sanity/client';

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sanityClient = createClient({
  projectId: 'arbp7h2s',
  dataset: 'production',
  apiVersion: '2023-05-03',
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});

async function main() {
  const orders = await sanityClient.fetch<Array<{ _id: string; orderNumber: string }>>(
    '*[_type == "order"]{ _id, orderNumber } | order(orderNumber desc)'
  );

  console.log('Total orders in Sanity:', orders.length);

  // Check for duplicate order numbers
  const orderNumberMap = new Map<string, string[]>();

  for (const order of orders) {
    if (!orderNumberMap.has(order.orderNumber)) {
      orderNumberMap.set(order.orderNumber, []);
    }
    orderNumberMap.get(order.orderNumber)!.push(order._id);
  }

  // Find duplicates
  const duplicates = Array.from(orderNumberMap.entries()).filter(([_, ids]) => ids.length > 1);

  if (duplicates.length > 0) {
    console.log('\nDUPLICATE ORDER NUMBERS FOUND:');
    for (const [num, ids] of duplicates) {
      console.log(`  ${num}: ${ids.length} instances`);
      ids.forEach(id => console.log(`    - ${id}`));
    }
  } else {
    console.log('\nNo duplicate order numbers - all orders are unique!');
  }

  console.log('\nOrder count summary:');
  console.log('  Unique order numbers:', orderNumberMap.size);
  console.log('  Total documents:', orders.length);
  console.log('  Match:', orderNumberMap.size === orders.length ? 'YES' : 'NO - DUPLICATES EXIST');
}

main();
