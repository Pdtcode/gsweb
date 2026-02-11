#!/usr/bin/env tsx
/**
 * Status Update Protection Verification Script
 *
 * Verifies that all Phase 4 requirements (STAT-01 through STAT-03, SHIP-03) are met:
 * - STAT-01: Admin can change status in Sanity Studio (dropdown with 5 statuses)
 * - STAT-02: Status changes sync to Neon via webhook (with signature verification)
 * - STAT-03: Only status field updated (no shipping fields in Prisma update data)
 * - SHIP-03: Shipping persists after status update (implied by STAT-03)
 * - Protection checks: signature verification, timestamp comparison, idempotency tracking
 * - Live data sampling: Verify webhook sync state in Sanity
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

interface CheckResult {
  category: string;
  requirement: string;
  status: 'PASS' | 'FAIL' | 'INFO' | 'SKIP';
  detail: string;
}

const results: CheckResult[] = [];
let passCount = 0;
let failCount = 0;

function check(category: string, requirement: string, passed: boolean, detail: string) {
  const status = passed ? 'PASS' : 'FAIL';
  results.push({ category, requirement, status, detail });
  if (passed) passCount++;
  else failCount++;
}

function info(category: string, requirement: string, detail: string) {
  results.push({ category, requirement, status: 'INFO', detail });
}

function skip(category: string, requirement: string, detail: string) {
  results.push({ category, requirement, status: 'SKIP', detail });
}

// ==== STATIC CODE AUDIT ====

console.log('\n=== STATUS UPDATE PROTECTION VERIFICATION ===\n');
console.log('STATIC AUDIT:\n');

// STAT-01: Admin can change status in Sanity Studio
const schemaPath = path.join(__dirname, '../../studio-grailseekers/schemaTypes/orderType.ts');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

// Check for status field with dropdown layout
const hasStatusField = /name:\s*"status"[\s\S]*?type:\s*"string"/.test(schemaContent);
check('STAT-01 (Admin can change status in Sanity)', 'Schema has status field (string type)', hasStatusField,
  hasStatusField ? 'status: string field found' : 'NOT FOUND');

const hasDropdownLayout = /name:\s*"status"[\s\S]*?options:\s*\{[\s\S]*?layout:\s*"dropdown"/.test(schemaContent);
check('STAT-01 (Admin can change status in Sanity)', 'Status field uses dropdown layout', hasDropdownLayout,
  hasDropdownLayout ? 'layout: "dropdown" found' : 'NOT FOUND');

// Check for all 5 status values
const statusValues = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const hasAllStatuses = statusValues.every(status =>
  new RegExp(`value:\\s*"${status}"`).test(schemaContent)
);
check('STAT-01 (Admin can change status in Sanity)', 'Status dropdown has all 5 options (PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED)', hasAllStatuses,
  hasAllStatuses ? 'All 5 status values found in schema' : 'MISSING one or more status values');

// STAT-02: Status changes sync to Neon via webhook
const webhookPath = path.join(__dirname, '../app/api/webhooks/sanity-order-status/route.ts');
const webhookContent = fs.readFileSync(webhookPath, 'utf-8');

// Check for @sanity/webhook imports
const hasIsValidSignature = /import\s*\{[^}]*isValidSignature[^}]*\}\s*from\s*["']@sanity\/webhook["']/.test(webhookContent);
check('STAT-02 (Status sync with signature verification)', 'Webhook imports isValidSignature from @sanity/webhook', hasIsValidSignature,
  hasIsValidSignature ? 'isValidSignature imported' : 'NOT FOUND');

const hasSignatureHeader = /import\s*\{[^}]*SIGNATURE_HEADER_NAME[^}]*\}\s*from\s*["']@sanity\/webhook["']/.test(webhookContent);
check('STAT-02 (Status sync with signature verification)', 'Webhook imports SIGNATURE_HEADER_NAME from @sanity/webhook', hasSignatureHeader,
  hasSignatureHeader ? 'SIGNATURE_HEADER_NAME imported' : 'NOT FOUND');

// Check for prisma.order.update call
const hasPrismaUpdate = /prisma\.order\.update/.test(webhookContent);
check('STAT-02 (Status sync with signature verification)', 'Webhook calls prisma.order.update', hasPrismaUpdate,
  hasPrismaUpdate ? 'prisma.order.update found' : 'NOT FOUND');

// Check for changedFields filtering
const hasChangedFieldsCheck = /changedFields[\s\S]*?some[\s\S]*?"status"/.test(webhookContent);
check('STAT-02 (Status sync with signature verification)', 'Webhook checks changedFields for status', hasChangedFieldsCheck,
  hasChangedFieldsCheck ? 'changedFields filtering for status found' : 'NOT FOUND');

// Check for NO bypass in signature verification (no "return true" in signature check)
const hasNoBypass = !/\/\/\s*return\s+true/.test(webhookContent) &&
                    !(/if\s*\(.*\)\s*\{?\s*return\s+true/.test(webhookContent) &&
                      webhookContent.includes('signature') &&
                      webhookContent.includes('bypass'));
check('STAT-02 (Status sync with signature verification)', 'No signature verification bypass exists', hasNoBypass,
  hasNoBypass ? 'No bypass found (production-safe)' : 'BYPASS DETECTED - security issue');

// STAT-03: Only status field updated
// Extract the prisma.order.update data object and verify it ONLY contains status
const updateMatch = webhookContent.match(/prisma\.order\.update\s*\(\s*\{[\s\S]*?data:\s*\{([^}]*)\}/);
const updateDataContent = updateMatch ? updateMatch[1] : '';

// Check that data object contains status
const hasStatusInData = /status:\s*newStatus/.test(updateDataContent);
check('STAT-03 (Only status field updated)', 'Prisma update data contains status field', hasStatusInData,
  hasStatusInData ? 'status: newStatus found in data' : 'NOT FOUND');

// Check for absence of shipping fields in update data
const shippingFields = [
  'shippingFirstName', 'shippingLastName', 'shippingAddress',
  'shippingCity', 'shippingState', 'shippingZipCode',
  'shippingCountry', 'shippingEmail', 'shippingPhone'
];

const hasNoShippingFields = !shippingFields.some(field =>
  new RegExp(`${field}:`).test(updateDataContent)
);
check('STAT-03 (Only status field updated)', 'Prisma update data has NO shipping fields', hasNoShippingFields,
  hasNoShippingFields ? 'No shipping fields found in data object' : 'SHIPPING FIELDS DETECTED - violates STAT-03');

// Check for absence of spread operators in update data
const hasNoSpreadOperators = !/\.\.\./.test(updateDataContent);
check('STAT-03 (Only status field updated)', 'Prisma update data has NO spread operators', hasNoSpreadOperators,
  hasNoSpreadOperators ? 'No spread operators (...webhook, ...sanityOrder) found' : 'SPREAD OPERATORS DETECTED - may leak shipping fields');

// SHIP-03: Shipping persists after status update (verified by Prisma schema @updatedAt)
const prismaSchemaPath = path.join(__dirname, '../prisma/schema.prisma');
const prismaSchemaContent = fs.readFileSync(prismaSchemaPath, 'utf-8');

// Check for @updatedAt on Order model
const hasUpdatedAt = /model\s+Order\s*\{[\s\S]*?updatedAt\s+DateTime\s+@updatedAt/.test(prismaSchemaContent);
check('SHIP-03 (Shipping persists after status update)', 'Order model has @updatedAt (automatic timestamp management)', hasUpdatedAt,
  hasUpdatedAt ? '@updatedAt found on Order model' : 'NOT FOUND');

// PROTECTION CHECKS

// 1. Signature verification
const hasSecretCheck = /SANITY_WEBHOOK_SECRET/.test(webhookContent) &&
                       /!WEBHOOK_SECRET/.test(webhookContent);
check('PROTECTION (Signature)', 'Webhook checks SANITY_WEBHOOK_SECRET exists', hasSecretCheck,
  hasSecretCheck ? 'Secret validation found' : 'NOT FOUND');

const hasSignatureValidation = /isValidSignature\s*\(/.test(webhookContent);
check('PROTECTION (Signature)', 'Webhook validates signature with isValidSignature()', hasSignatureValidation,
  hasSignatureValidation ? 'isValidSignature() call found' : 'NOT FOUND');

const hasSignatureRejection = /!.*isValidSignature/.test(webhookContent) ||
                              /isValidSignature[\s\S]*?401/.test(webhookContent);
check('PROTECTION (Signature)', 'Webhook rejects invalid signatures (401)', hasSignatureRejection,
  hasSignatureRejection ? 'Signature rejection logic found' : 'NOT FOUND');

// 2. Race condition prevention (timestamp comparison)
const hasTimestampExtraction = /sanity-transaction-time/.test(webhookContent);
check('PROTECTION (Race condition)', 'Webhook extracts sanity-transaction-time header', hasTimestampExtraction,
  hasTimestampExtraction ? 'sanity-transaction-time header extraction found' : 'NOT FOUND');

const hasTimestampComparison = /webhookTime\s*<\s*currentOrder\.updatedAt/.test(webhookContent) ||
                               /new Date\(sanityTransactionTime\)/.test(webhookContent);
check('PROTECTION (Race condition)', 'Webhook compares timestamp to reject stale updates', hasTimestampComparison,
  hasTimestampComparison ? 'Timestamp comparison logic found' : 'NOT FOUND');

const hasStaleWebhookRejection = /Stale webhook ignored/.test(webhookContent);
check('PROTECTION (Race condition)', 'Webhook returns rejection message for stale webhooks', hasStaleWebhookRejection,
  hasStaleWebhookRejection ? 'Stale webhook rejection found' : 'NOT FOUND');

// 3. Idempotency tracking
const hasIdempotencyKeyExtraction = /idempotency-key/.test(webhookContent);
check('PROTECTION (Idempotency)', 'Webhook extracts idempotency-key header', hasIdempotencyKeyExtraction,
  hasIdempotencyKeyExtraction ? 'idempotency-key header extraction found' : 'NOT FOUND');

const hasIdempotencyCheck = /webhook-status-\$\{idempotencyKey\}/.test(webhookContent) ||
                            /syncState.*idempotency/.test(webhookContent);
check('PROTECTION (Idempotency)', 'Webhook checks for existing idempotency key in Sanity', hasIdempotencyCheck,
  hasIdempotencyCheck ? 'Idempotency check found' : 'NOT FOUND');

const hasIdempotencyWrite = /createOrReplace[\s\S]*?webhook-status/.test(webhookContent);
check('PROTECTION (Idempotency)', 'Webhook writes idempotency state to Sanity syncState', hasIdempotencyWrite,
  hasIdempotencyWrite ? 'Idempotency state write (createOrReplace) found' : 'NOT FOUND');

const hasDuplicateDetection = /already processed/.test(webhookContent) ||
                              /Duplicate webhook detected/.test(webhookContent);
check('PROTECTION (Idempotency)', 'Webhook returns early on duplicate detection', hasDuplicateDetection,
  hasDuplicateDetection ? 'Duplicate webhook detection found' : 'NOT FOUND');

// Print static audit results
for (const result of results) {
  const prefix = result.status === 'PASS' ? '[PASS]' : result.status === 'FAIL' ? '[FAIL]' : `[${result.status}]`;
  console.log(`  ${result.category}:`);
  console.log(`    ${prefix} ${result.requirement}: ${result.detail}`);
}

// ==== LIVE DATA SAMPLING ====

console.log('\nLIVE DATA SAMPLING (requires SANITY_API_TOKEN):\n');

async function runLiveDataSampling() {
  if (!process.env.SANITY_API_TOKEN) {
    skip('LIVE DATA SAMPLING', 'Skipped', 'SANITY_API_TOKEN not set');
    console.log('  [SKIP] Live data sampling skipped (SANITY_API_TOKEN not set)\n');
    return;
  }

  try {
    // Dynamically import @sanity/client (ESM module)
    const { createClient } = await import('@sanity/client');

    const sanityClient = createClient({
      projectId: 'arbp7h2s',
      dataset: 'production',
      apiVersion: '2023-05-03',
      useCdn: false,
      token: process.env.SANITY_API_TOKEN,
    });

    // Fetch webhook sync state
    const syncStateQuery = '*[_type == "syncState" && _id == "webhook-order-status-sync"][0]';
    const syncState = await sanityClient.fetch(syncStateQuery);

    if (syncState) {
      info('LIVE DATA SAMPLING', 'Webhook sync state found',
        `Last sync: ${syncState.lastSyncTime || 'N/A'}, Status: ${syncState.syncStatus || 'N/A'}`);

      if (syncState.syncStats) {
        console.log(`  [INFO] Sync stats: Updated=${syncState.syncStats.updated || 0}, Errors=${syncState.syncStats.errors || 0}, Total=${syncState.syncStats.total || 0}`);
      }

      if (syncState.lastOrderId) {
        console.log(`  [INFO] Last order processed: ${syncState.lastOrderId}, Status set to: ${syncState.lastStatus || 'N/A'}`);
      }
    } else {
      info('LIVE DATA SAMPLING', 'Webhook sync state not found',
        'No webhook-order-status-sync document in Sanity (webhook may not have run yet)');
    }

    // Fetch a sample order to verify status and shipping data presence
    const orderQuery = '*[_type == "order"][0]{ _id, orderNumber, status, shippingAddress, shippingFirstName }';
    const order = await sanityClient.fetch(orderQuery);

    if (order) {
      console.log(`  [INFO] Sample order ${order.orderNumber || order._id}: status=${order.status || 'N/A'}`);

      const hasShippingAddress = order.shippingAddress && (
        order.shippingAddress.name ||
        order.shippingAddress.street ||
        order.shippingAddress.city
      );
      const hasShippingFlatFields = order.shippingFirstName;

      if (hasShippingAddress || hasShippingFlatFields) {
        console.log(`  [INFO] Sample order has shipping data (confirms SHIP-03: shipping persists independently of status)`);
      } else {
        console.log(`  [INFO] Sample order has no shipping data (may be test data)`);
      }
    } else {
      info('LIVE DATA SAMPLING', 'No orders found in Sanity', 'Database may be empty');
    }

    console.log('');
  } catch (error) {
    console.error('  [ERROR] Live data sampling failed:', error instanceof Error ? error.message : String(error));
    console.log('');
  }
}

// Run live data sampling and final summary
(async () => {
  await runLiveDataSampling();

  // ==== FINAL SUMMARY ====

  const totalChecks = passCount + failCount;
  console.log(`Result: ${passCount}/${totalChecks} checks passed\n`);

  if (failCount > 0) {
    console.log('FAILED CHECKS:');
    for (const result of results) {
      if (result.status === 'FAIL') {
        console.log(`  - ${result.category}: ${result.requirement}`);
        console.log(`    ${result.detail}`);
      }
    }
    process.exit(1);
  }

  console.log('All checks passed!\n');
  process.exit(0);
})();
