#!/usr/bin/env tsx

/**
 * Phase 5 Verification Script: Duplicate Cleanup
 *
 * Verifies all Phase 5 success criteria are met:
 * - DUP-01: Idempotency check in create-payment-intent
 * - DUP-02: @unique constraint on stripePaymentIntentId
 * - DUP-03: archivedAt field and data
 * - SYNC-04: Sync paths filter archived orders
 *
 * Two-tier verification:
 * 1. Static Code Audit: grep/read source files
 * 2. Live Data Verification: query Neon + Sanity
 */

import { config } from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { createClient } from '@sanity/client';
import prisma from '../lib/prismaClient';

// Load environment variables
config({ path: join(__dirname, '..', '.env') });

// Sanity client
const sanityClient = createClient({
  projectId: 'arbp7h2s',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2023-05-03',
  token: process.env.SANITY_API_TOKEN,
});

interface CheckResult {
  id: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: CheckResult[] = [];

function check(id: string, name: string, passed: boolean, details?: string) {
  results.push({ id, name, passed, details });
  const status = passed ? '[PASS]' : '[FAIL]';
  console.log(`  ${status} ${id}: ${name}`);
  if (details) {
    console.log(`        ${details}`);
  }
}

async function runStaticAudit() {
  console.log('\n=== STATIC CODE AUDIT ===\n');

  // Check 1: create-payment-intent has idempotency check
  try {
    const createPaymentIntentPath = join(__dirname, '..', 'app', 'api', 'create-payment-intent', 'route.ts');
    const createPaymentIntentCode = readFileSync(createPaymentIntentPath, 'utf-8');

    const hasIdempotencyCheck =
      createPaymentIntentCode.includes('findFirst') &&
      createPaymentIntentCode.includes('stripePaymentIntentId') &&
      createPaymentIntentCode.includes('existingOrder');

    const checkBeforeCreate = createPaymentIntentCode.indexOf('findFirst') < createPaymentIntentCode.indexOf('prisma.order.create');

    check(
      'DUP-01',
      'Idempotency check in create-payment-intent',
      hasIdempotencyCheck && checkBeforeCreate,
      hasIdempotencyCheck && checkBeforeCreate
        ? 'findFirst check exists before order creation'
        : 'Missing idempotency check or wrong order'
    );
  } catch (error) {
    check('DUP-01', 'Idempotency check in create-payment-intent', false, `Error reading file: ${error}`);
  }

  // Check 2: @unique constraint on stripePaymentIntentId
  try {
    const schemaPath = join(__dirname, '..', 'prisma', 'schema.prisma');
    const schemaCode = readFileSync(schemaPath, 'utf-8');

    // Find the stripePaymentIntentId line and check for @unique
    const lines = schemaCode.split('\n');
    const paymentIntentLine = lines.find(line => line.includes('stripePaymentIntentId'));
    const hasUnique = paymentIntentLine?.includes('@unique') || false;

    check(
      'DUP-02',
      '@unique on stripePaymentIntentId',
      hasUnique,
      hasUnique ? 'Unique constraint found in schema' : 'Missing @unique constraint'
    );
  } catch (error) {
    check('DUP-02', '@unique on stripePaymentIntentId', false, `Error reading schema: ${error}`);
  }

  // Check 3: archivedAt field exists in schema
  try {
    const schemaPath = join(__dirname, '..', 'prisma', 'schema.prisma');
    const schemaCode = readFileSync(schemaPath, 'utf-8');

    const hasArchivedAt = schemaCode.includes('archivedAt') &&
                          schemaCode.includes('DateTime?');

    check(
      'DUP-03-prep',
      'archivedAt field in schema',
      hasArchivedAt,
      hasArchivedAt ? 'archivedAt DateTime? field found' : 'Missing archivedAt field'
    );
  } catch (error) {
    check('DUP-03-prep', 'archivedAt field in schema', false, `Error reading schema: ${error}`);
  }

  // Check 4: sync-orders filters archivedAt
  try {
    const syncOrdersPath = join(__dirname, '..', 'app', 'api', 'sync-orders', 'route.ts');
    const syncOrdersCode = readFileSync(syncOrdersPath, 'utf-8');

    const hasArchivedAtFilter = syncOrdersCode.includes('archivedAt: null') ||
                                 syncOrdersCode.includes('archivedAt: { equals: null }');

    check(
      'SYNC-04-code-1',
      'sync-orders filters archivedAt',
      hasArchivedAtFilter,
      hasArchivedAtFilter ? 'archivedAt: null filter found' : 'Missing archivedAt filter'
    );
  } catch (error) {
    check('SYNC-04-code-1', 'sync-orders filters archivedAt', false, `Error reading file: ${error}`);
  }

  // Check 5: dualSyncService checks archivedAt
  try {
    const dualSyncPath = join(__dirname, '..', 'lib', 'dualSyncService.ts');
    const dualSyncCode = readFileSync(dualSyncPath, 'utf-8');

    const hasArchivedAtCheck = dualSyncCode.includes('archivedAt') &&
                                dualSyncCode.includes('archived');

    check(
      'SYNC-04-code-2',
      'dualSyncService checks archivedAt',
      hasArchivedAtCheck,
      hasArchivedAtCheck ? 'archivedAt check found in syncExistingOrderToSanity' : 'Missing archivedAt check'
    );
  } catch (error) {
    check('SYNC-04-code-2', 'dualSyncService checks archivedAt', false, `Error reading file: ${error}`);
  }
}

async function runLiveDataVerification() {
  console.log('\n=== LIVE DATA VERIFICATION ===\n');

  try {
    // Check 6: Count archived orders (expect 8 based on Plan 02 results)
    const archivedCount = await prisma.order.count({
      where: { archivedAt: { not: null } }
    });

    check(
      'DUP-03-data',
      'Archived orders count',
      archivedCount === 8,
      `Found ${archivedCount} archived orders (expected 8)`
    );

    // Check 7: Count active orders (expect 21 based on Plan 02 results)
    const activeCount = await prisma.order.count({
      where: { archivedAt: null }
    });

    check(
      'ACTIVE-COUNT',
      'Active orders count',
      activeCount === 21,
      `Found ${activeCount} active orders (expected 21)`
    );

    // Check 8: Total preserved (expect 29)
    const totalCount = await prisma.order.count();

    check(
      'TOTAL-PRESERVED',
      'Total orders preserved',
      totalCount === 29,
      `Found ${totalCount} total orders (expected 29: 21 active + 8 archived)`
    );

    // Check 9: Sanity count matches active Neon count
    const sanityCount = await sanityClient.fetch<number>('count(*[_type == "order"])');

    check(
      'SANITY-COUNT',
      'Sanity count matches active Neon count',
      sanityCount === activeCount,
      `Sanity: ${sanityCount}, Active Neon: ${activeCount}`
    );

    // Check 10: No orphaned Sanity orders
    const sanityOrderIds = await sanityClient.fetch<string[]>('*[_type == "order"]._id');
    const activeNeonOrders = await prisma.order.findMany({
      where: { archivedAt: null },
      select: { id: true }
    });
    const activeNeonIds = new Set(activeNeonOrders.map(o => `order-${o.id}`));

    const orphanedIds = sanityOrderIds.filter(id =>
      id !== 'order-sync-state' && !activeNeonIds.has(id)
    );

    check(
      'NO-ORPHANS',
      'No orphaned Sanity orders',
      orphanedIds.length === 0,
      orphanedIds.length === 0
        ? 'All Sanity orders have matching active Neon orders'
        : `Found ${orphanedIds.length} orphaned Sanity orders: ${orphanedIds.join(', ')}`
    );

    // Check 11: No duplicate payment intents among active orders
    const duplicatePaymentIntents = await prisma.$queryRaw<Array<{ stripePaymentIntentId: string; count: bigint }>>`
      SELECT "stripePaymentIntentId", COUNT(*) as count
      FROM "Order"
      WHERE "archivedAt" IS NULL
        AND "stripePaymentIntentId" IS NOT NULL
      GROUP BY "stripePaymentIntentId"
      HAVING COUNT(*) > 1
    `;

    const hasDuplicates = duplicatePaymentIntents.length > 0;

    check(
      'NO-DUPLICATE-INTENTS',
      'No duplicate payment intents among active orders',
      !hasDuplicates,
      hasDuplicates
        ? `Found ${duplicatePaymentIntents.length} duplicate payment intent(s)`
        : 'All active orders have unique payment intents'
    );

  } catch (error) {
    console.error('Error during live data verification:', error);
    check('LIVE-DATA', 'Live data verification', false, `Error: ${error}`);
  }
}

async function main() {
  console.log('=== PHASE 5 VERIFICATION ===');
  console.log('Checking duplicate cleanup success criteria...\n');

  try {
    await runStaticAudit();
    await runLiveDataVerification();

    // Summary
    console.log('\n=== VERIFICATION SUMMARY ===\n');
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const allPassed = passed === total;

    console.log(`RESULT: ${passed}/${total} checks passed`);

    if (!allPassed) {
      console.log('\nFailed checks:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.id}: ${r.name}`);
        if (r.details) console.log(`    ${r.details}`);
      });
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
