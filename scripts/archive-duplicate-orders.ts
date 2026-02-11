#!/usr/bin/env tsx
/**
 * Archive Duplicate Orders Script
 *
 * Purpose: Identify and soft-archive duplicate orders in Neon, clean up their
 * Sanity documents, and re-sync all active orders.
 *
 * Duplicate identification strategy:
 * - Group by stripePaymentIntentId (primary indicator of same purchase)
 * - For orders without payment intent, group by: same userId + same total + created within 60s
 * - Within each group, keep the MOST RECENT order (highest createdAt) as active
 * - Archive the rest by setting archivedAt = new Date()
 *
 * Phases:
 * A. Identify duplicates
 * B. DRY RUN gate (default: true)
 * C. Archive duplicates in Neon
 * D. Clean Sanity (delete archived order documents)
 * E. Re-sync active orders
 * F. Verify final state
 */

import * as path from 'path';
import { createClient } from '@sanity/client';
import { mapNeonOrderToSanity } from '../lib/mappers/orderMapper';

// Load environment variables FIRST before importing prismaClient
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import Prisma after env vars are loaded
import prisma from '../lib/prismaClient';

// Sanity client configuration
const sanityClient = createClient({
  projectId: 'arbp7h2s',
  dataset: 'production',
  apiVersion: '2023-05-03',
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});

const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to true for safety

interface OrderGroup {
  key: string;
  orders: Array<{
    id: string;
    orderNumber: string;
    createdAt: Date;
    stripePaymentIntentId: string | null;
    userId: string;
    total: any;
  }>;
}

async function main() {
  console.log('\n=== ARCHIVE DUPLICATE ORDERS ===\n');
  console.log('Timestamp:', new Date().toISOString());
  console.log('DRY RUN MODE:', DRY_RUN ? 'ENABLED (no changes will be made)' : 'DISABLED (changes will be applied)');
  console.log('');

  try {
    // Check Sanity token
    if (!process.env.SANITY_API_TOKEN) {
      throw new Error('SANITY_API_TOKEN environment variable is not set');
    }

    // === PHASE A: Identify duplicates ===
    console.log('PHASE A: Identifying duplicate orders...\n');

    // Fetch all orders from Neon
    const allOrders = await prisma.order.findMany({
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        stripePaymentIntentId: true,
        userId: true,
        total: true,
        archivedAt: true,
      },
      orderBy: {
        createdAt: 'asc', // Oldest first so we can identify duplicates
      },
    });

    console.log(`Found ${allOrders.length} total orders in Neon database`);
    const activeOrders = allOrders.filter(o => !o.archivedAt);
    console.log(`Active orders (not archived): ${activeOrders.length}`);
    console.log('');

    // Group orders by stripePaymentIntentId (for reference - true duplicates with same PI)
    const groupsByPaymentIntent = new Map<string, OrderGroup>();
    const ordersWithPaymentIntent: typeof activeOrders = [];
    const ordersWithoutPaymentIntent: typeof activeOrders = [];

    for (const order of activeOrders) {
      if (order.stripePaymentIntentId) {
        ordersWithPaymentIntent.push(order);
        const key = order.stripePaymentIntentId;
        if (!groupsByPaymentIntent.has(key)) {
          groupsByPaymentIntent.set(key, { key, orders: [] });
        }
        groupsByPaymentIntent.get(key)!.orders.push(order);
      } else {
        ordersWithoutPaymentIntent.push(order);
      }
    }

    console.log(`Orders with payment intent: ${ordersWithPaymentIntent.length}`);
    console.log(`Orders without payment intent: ${ordersWithoutPaymentIntent.length}`);
    console.log('');

    // Group ALL orders by heuristic: userId + total + time window
    // This catches duplicates where user went through checkout multiple times (different payment intents)
    const groupsByHeuristic = new Map<string, OrderGroup>();

    for (const order of activeOrders) {
      const totalStr = String(order.total);
      const key = `${order.userId}|${totalStr}`;

      // Find existing group within 60 second window
      let foundGroup = false;
      for (const group of groupsByHeuristic.values()) {
        if (group.key === key) {
          // Check if this order is within 60 seconds of any order in the group
          for (const existingOrder of group.orders) {
            const timeDiff = Math.abs(order.createdAt.getTime() - existingOrder.createdAt.getTime());
            if (timeDiff <= 60000) { // 60 seconds
              group.orders.push(order);
              foundGroup = true;
              break;
            }
          }
          if (foundGroup) break;
        }
      }

      if (!foundGroup) {
        groupsByHeuristic.set(`${key}|${order.createdAt.getTime()}`, { key, orders: [order] });
      }
    }

    // Identify duplicates: groups with more than 1 order
    const duplicateGroupsByPaymentIntent = Array.from(groupsByPaymentIntent.values()).filter(g => g.orders.length > 1);
    const duplicateGroupsByHeuristic = Array.from(groupsByHeuristic.values()).filter(g => g.orders.length > 1);

    console.log('DUPLICATE GROUPS BY PAYMENT INTENT:');
    if (duplicateGroupsByPaymentIntent.length === 0) {
      console.log('  None found');
    } else {
      for (const group of duplicateGroupsByPaymentIntent) {
        console.log(`\n  Payment Intent: ${group.key}`);
        console.log(`  ${group.orders.length} orders in this group:`);
        for (const order of group.orders) {
          console.log(`    - ${order.orderNumber} (${order.id}) created at ${order.createdAt.toISOString()}`);
        }
      }
    }
    console.log('');

    console.log('DUPLICATE GROUPS BY HEURISTIC (userId + total + time):');
    if (duplicateGroupsByHeuristic.length === 0) {
      console.log('  None found');
    } else {
      for (const group of duplicateGroupsByHeuristic) {
        console.log(`\n  Key: ${group.key}`);
        console.log(`  ${group.orders.length} orders in this group:`);
        for (const order of group.orders) {
          console.log(`    - ${order.orderNumber} (${order.id}) created at ${order.createdAt.toISOString()}`);
        }
      }
    }
    console.log('');

    // Determine which orders to archive
    const ordersToArchive: string[] = [];
    const allDuplicateGroups = [...duplicateGroupsByPaymentIntent, ...duplicateGroupsByHeuristic];

    for (const group of allDuplicateGroups) {
      // Sort by createdAt descending (most recent first)
      const sortedOrders = [...group.orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Keep the most recent, archive the rest
      const [keep, ...archive] = sortedOrders;
      console.log(`Group with ${group.orders.length} orders:`);
      console.log(`  KEEP: ${keep.orderNumber} (${keep.id}) - most recent (${keep.createdAt.toISOString()})`);
      for (const order of archive) {
        console.log(`  ARCHIVE: ${order.orderNumber} (${order.id}) - older (${order.createdAt.toISOString()})`);
        ordersToArchive.push(order.id);
      }
      console.log('');
    }

    console.log(`SUMMARY: ${ordersToArchive.length} orders will be archived`);
    console.log('');

    // === PHASE B: DRY RUN gate ===
    if (DRY_RUN) {
      console.log('=== DRY RUN MODE - NO CHANGES WILL BE MADE ===');
      console.log('');
      console.log('To run for real, execute:');
      console.log('  DRY_RUN=false npx tsx scripts/archive-duplicate-orders.ts');
      console.log('');
      return;
    }

    // === PHASE C: Archive duplicates in Neon ===
    console.log('PHASE C: Archiving duplicate orders in Neon...\n');

    if (ordersToArchive.length === 0) {
      console.log('No orders to archive');
    } else {
      const now = new Date();
      for (const orderId of ordersToArchive) {
        try {
          await prisma.order.update({
            where: { id: orderId },
            data: { archivedAt: now },
          });
          console.log(`  [ARCHIVED] Order ${orderId}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`  [ERROR] Failed to archive order ${orderId}:`, errorMessage);
        }
      }
      console.log(`\nArchived ${ordersToArchive.length} orders in Neon`);
    }
    console.log('');

    // === PHASE D: Clean Sanity (delete archived order documents) ===
    console.log('PHASE D: Cleaning up Sanity...\n');

    if (ordersToArchive.length === 0) {
      console.log('No Sanity documents to delete');
    } else {
      const sanityIdsToDelete = ordersToArchive.map(id => `order-${id}`);
      console.log(`Deleting ${sanityIdsToDelete.length} Sanity documents...`);

      const tx = sanityClient.transaction();
      for (const id of sanityIdsToDelete) {
        tx.delete(id);
      }
      await tx.commit();
      console.log(`Deleted ${sanityIdsToDelete.length} archived order documents from Sanity`);
    }
    console.log('');

    // === PHASE E: Re-sync active orders ===
    console.log('PHASE E: Re-syncing all active orders to Sanity...\n');

    // Fetch all active orders with full relations
    const activeOrdersWithRelations = await prisma.order.findMany({
      where: {
        archivedAt: null, // Only active orders
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
            ProductVariant: {
              select: {
                sku: true,
                color: true,
                size: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    console.log(`Re-syncing ${activeOrdersWithRelations.length} active orders to Sanity...`);
    let syncedCount = 0;
    for (const order of activeOrdersWithRelations) {
      try {
        const sanityDoc = mapNeonOrderToSanity(order);
        await sanityClient.createOrReplace(sanityDoc);
        console.log(`  [SYNCED] ${sanityDoc._id} (${order.orderNumber})`);
        syncedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  [ERROR] Failed to sync order ${order.orderNumber}:`, errorMessage);
      }
    }
    console.log(`\nSuccessfully re-synced ${syncedCount} active orders`);
    console.log('');

    // === PHASE F: Verify final state ===
    console.log('PHASE F: Verifying final state...\n');

    const neonActiveCount = await prisma.order.count({ where: { archivedAt: null } });
    const neonArchivedCount = await prisma.order.count({ where: { archivedAt: { not: null } } });
    const sanityOrderCount = await sanityClient.fetch<number>('count(*[_type == "order"])');

    console.log('Final State:');
    console.log(`  Neon active orders: ${neonActiveCount}`);
    console.log(`  Neon archived orders: ${neonArchivedCount}`);
    console.log(`  Sanity orders: ${sanityOrderCount}`);
    console.log('');

    if (neonActiveCount === sanityOrderCount) {
      console.log('SUCCESS: Sanity order count matches active Neon orders');
    } else {
      console.log(`WARNING: Mismatch - Neon has ${neonActiveCount} active orders, but Sanity has ${sanityOrderCount}`);
    }
    console.log('');

    // === SUMMARY ===
    console.log('=== ARCHIVE SUMMARY ===');
    console.log(`Archived in Neon: ${ordersToArchive.length} orders`);
    console.log(`Deleted from Sanity: ${ordersToArchive.length} documents`);
    console.log(`Re-synced: ${syncedCount} active orders`);
    console.log(`Final active count: ${neonActiveCount}`);
    console.log(`Final archived count: ${neonArchivedCount}`);
    console.log(`Status: ${neonActiveCount === sanityOrderCount ? 'SUCCESS' : 'NEEDS INVESTIGATION'}`);
    console.log('');

  } catch (error) {
    console.error('\n=== ARCHIVE FAILED ===');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main();
