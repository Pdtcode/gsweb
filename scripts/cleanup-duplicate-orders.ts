#!/usr/bin/env tsx
/**
 * Duplicate Order Cleanup Script
 *
 * Purpose: Delete 14 legacy duplicate orders from Sanity and re-sync 15 valid orders.
 * This satisfies SYNC-04 by ensuring Sanity contains exactly 15 orders matching Neon.
 *
 * Phases:
 * A. Delete 14 known duplicates (hardcoded IDs)
 * B. Re-sync all 15 valid orders from Neon
 * C. Verify final count equals 15
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

// The 14 known duplicate order IDs to delete
const DUPLICATE_IDS = [
  'order-bc4b5d9b-a29a-4986-ab13-1d18c314da41',
  'order-56cfae23-8627-4f3a-8802-b83843ae4520',
  'order-c0ef106a-ad21-4daf-9966-065cad9c6d60',
  'order-4edc1ea8-5f27-4ad6-b214-bff0c0ab3def',
  'order-381371e4-d6a9-43da-81d1-cbf730a7b7e9',
  'order-f939b5ff-f20b-41cb-9d4f-df7c9b1d8284',
  'order-851767f5-6d8d-49f6-b5cf-f099ce476892',
  'order-5e858d94-1e23-43dc-a6ee-a1e9143905ce',
  'order-f6fd4ed7-7271-409c-beb7-60a673cd1d87',
  'order-5e2e1186-6cac-4608-ba47-40a8981c9c94',
  'order-4317356a-a9bb-406f-99b2-3243babecd60',
  'order-24085a82-8719-4bcb-b476-f7247075c9e0',
  'order-00838aa7-0be9-4632-a1ed-137e0480360e',
  'order-7d2f2ef5-ca60-400e-8af8-77431a7fc5c6',
];

const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  console.log('\n=== DUPLICATE ORDER CLEANUP ===\n');
  console.log('Timestamp:', new Date().toISOString());
  console.log('DRY RUN MODE:', DRY_RUN ? 'ENABLED (no changes will be made)' : 'DISABLED (changes will be applied)');
  console.log('');

  try {
    // Check Sanity token
    if (!process.env.SANITY_API_TOKEN) {
      throw new Error('SANITY_API_TOKEN environment variable is not set');
    }

    // === SAFETY: Log all existing orders before cleanup ===
    console.log('SAFETY CHECK: Fetching all existing orders from Sanity...');
    const existingOrders = await sanityClient.fetch<Array<{ _id: string; orderNumber: string }>>(
      '*[_type == "order"]{ _id, orderNumber } | order(orderNumber desc)'
    );
    console.log(`Found ${existingOrders.length} existing orders in Sanity:\n`);
    for (const order of existingOrders) {
      console.log(`  - ${order._id} (${order.orderNumber || 'no order number'})`);
    }
    console.log('');

    // === PHASE A: Delete 14 duplicates ===
    console.log('PHASE A: Deleting 14 duplicate orders...\n');

    // Verify which duplicates exist before attempting deletion
    const duplicatesToDelete: string[] = [];
    for (const id of DUPLICATE_IDS) {
      const exists = existingOrders.some(order => order._id === id);
      if (exists) {
        duplicatesToDelete.push(id);
        console.log(`  [FOUND] ${id} - will be deleted`);
      } else {
        console.log(`  [SKIP]  ${id} - not found in Sanity`);
      }
    }
    console.log(`\nVerified ${duplicatesToDelete.length}/${DUPLICATE_IDS.length} duplicates exist in Sanity`);
    console.log('');

    if (duplicatesToDelete.length > 0) {
      if (DRY_RUN) {
        console.log(`DRY RUN: Would delete ${duplicatesToDelete.length} duplicates`);
      } else {
        // Use transaction API for atomicity
        const tx = sanityClient.transaction();
        for (const id of duplicatesToDelete) {
          tx.delete(id);
        }
        await tx.commit();
        console.log(`Successfully deleted ${duplicatesToDelete.length} duplicate orders`);
      }
    } else {
      console.log('No duplicates to delete (all already removed)');
    }
    console.log('');

    // === PHASE B: Re-sync valid orders from Neon ===
    console.log('PHASE B: Re-syncing valid orders from Neon...\n');

    // Fetch all orders from Neon with full relations (same pattern as sync-orders/route.ts)
    const neonOrders = await prisma.order.findMany({
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

    console.log(`Found ${neonOrders.length} orders in Neon database`);
    console.log('');

    if (DRY_RUN) {
      console.log(`DRY RUN: Would re-sync ${neonOrders.length} orders to Sanity with deterministic IDs:`);
      for (const order of neonOrders) {
        const doc = mapNeonOrderToSanity(order);
        console.log(`  - ${doc._id} (${order.orderNumber})`);
      }
    } else {
      // Re-sync each order using createOrReplace for idempotency
      let syncedCount = 0;
      for (const order of neonOrders) {
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
      console.log(`\nSuccessfully re-synced ${syncedCount} valid orders`);
    }
    console.log('');

    // === PHASE C: Post-cleanup count ===
    console.log('PHASE C: Verifying final order count...\n');

    const finalCount = await sanityClient.fetch<number>('count(*[_type == "order"])');
    console.log(`Sanity order count: ${finalCount}`);

    if (finalCount === 15) {
      console.log('SUCCESS: Order count matches expected value (15)');
    } else {
      console.log(`WARNING: Expected 15 orders, but found ${finalCount}`);
    }
    console.log('');

    // === SUMMARY ===
    console.log('=== CLEANUP SUMMARY ===');
    console.log(`Deleted: ${duplicatesToDelete.length} duplicates`);
    console.log(`Re-synced: ${neonOrders.length} valid orders`);
    console.log(`Final count: ${finalCount} orders in Sanity`);
    console.log(`Status: ${finalCount === 15 ? 'SUCCESS' : 'NEEDS INVESTIGATION'}`);
    console.log('');

  } catch (error) {
    console.error('\n=== CLEANUP FAILED ===');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main();
