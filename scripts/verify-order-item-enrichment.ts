#!/usr/bin/env tsx
/**
 * Order Item Enrichment Verification Script
 *
 * Verifies that all Phase 3 requirements (ITEM-01 through ITEM-04) are met:
 * - ITEM-01: Product name, quantity, price in mapper
 * - ITEM-02: SKU, size, color from ProductVariant in mapper
 * - ITEM-03: Prisma queries include full OrderItem -> Product + ProductVariant chain
 * - ITEM-04: _key property on array items
 * - Schema alignment: Sanity schema has all enrichment fields
 * - Live data sampling: Verify actual Sanity documents have enrichment fields
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

console.log('\n=== ORDER ITEM ENRICHMENT VERIFICATION ===\n');
console.log('STATIC AUDIT:\n');

// ITEM-01: Mapper includes name, quantity, price
const mapperPath = path.join(__dirname, '../lib/mappers/orderMapper.ts');
const mapperContent = fs.readFileSync(mapperPath, 'utf-8');

// Check for name: item.Product.name
const hasName = /name:\s*item\.Product\.name/.test(mapperContent);
check('ITEM-01 (Product name, quantity, price)', 'Mapper includes name', hasName,
  hasName ? 'name: item.Product.name' : 'NOT FOUND');

// Check for quantity: item.quantity
const hasQuantity = /quantity:\s*item\.quantity/.test(mapperContent);
check('ITEM-01 (Product name, quantity, price)', 'Mapper includes quantity', hasQuantity,
  hasQuantity ? 'quantity: item.quantity' : 'NOT FOUND');

// Check for price: Number(item.price)
const hasPrice = /price:\s*Number\(item\.price\)/.test(mapperContent);
check('ITEM-01 (Product name, quantity, price)', 'Mapper includes price', hasPrice,
  hasPrice ? 'price: Number(item.price)' : 'NOT FOUND');

// ITEM-02: Mapper includes SKU, size, color from ProductVariant
const hasSku = /sku:\s*item\.ProductVariant\?\.sku/.test(mapperContent);
check('ITEM-02 (SKU, size, color from ProductVariant)', 'Mapper includes sku', hasSku,
  hasSku ? 'sku: item.ProductVariant?.sku ?? undefined' : 'NOT FOUND');

const hasSize = /size:\s*item\.ProductVariant\?\.size/.test(mapperContent);
check('ITEM-02 (SKU, size, color from ProductVariant)', 'Mapper includes size', hasSize,
  hasSize ? 'size: item.ProductVariant?.size ?? undefined' : 'NOT FOUND');

const hasColor = /color:\s*item\.ProductVariant\?\.color/.test(mapperContent);
check('ITEM-02 (SKU, size, color from ProductVariant)', 'Mapper includes color', hasColor,
  hasColor ? 'color: item.ProductVariant?.color ?? undefined' : 'NOT FOUND');

// ITEM-03: Prisma relation chains in dualSyncService.ts
const dualSyncPath = path.join(__dirname, '../lib/dualSyncService.ts');
const dualSyncContent = fs.readFileSync(dualSyncPath, 'utf-8');

// Check for OrderItem include with Product and ProductVariant
const dualSyncHasOrderItem = /OrderItem:\s*\{/.test(dualSyncContent);
const dualSyncHasProduct = /Product:\s*\{[\s\S]*?select:\s*\{[\s\S]*?name:\s*true/.test(dualSyncContent);
const dualSyncHasVariant = /ProductVariant:\s*\{[\s\S]*?select:\s*\{[\s\S]*?sku:\s*true[\s\S]*?color:\s*true[\s\S]*?size:\s*true/.test(dualSyncContent);

check('ITEM-03 (Prisma relation chain)', 'dualSyncService.ts: OrderItem includes Product (name)',
  dualSyncHasOrderItem && dualSyncHasProduct,
  dualSyncHasOrderItem && dualSyncHasProduct ? 'OrderItem.Product.select.name found' : 'NOT FOUND');

check('ITEM-03 (Prisma relation chain)', 'dualSyncService.ts: OrderItem includes ProductVariant (sku, color, size)',
  dualSyncHasOrderItem && dualSyncHasVariant,
  dualSyncHasOrderItem && dualSyncHasVariant ? 'OrderItem.ProductVariant.select with sku, color, size found' : 'NOT FOUND');

// ITEM-03: Prisma relation chains in sync-orders/route.ts
const syncOrdersPath = path.join(__dirname, '../app/api/sync-orders/route.ts');
const syncOrdersContent = fs.readFileSync(syncOrdersPath, 'utf-8');

const syncOrdersHasOrderItem = /OrderItem:\s*\{/.test(syncOrdersContent);
const syncOrdersHasProduct = /Product:\s*\{[\s\S]*?select:\s*\{[\s\S]*?name:\s*true/.test(syncOrdersContent);
const syncOrdersHasVariant = /ProductVariant:\s*\{[\s\S]*?select:\s*\{[\s\S]*?sku:\s*true[\s\S]*?color:\s*true[\s\S]*?size:\s*true/.test(syncOrdersContent);

check('ITEM-03 (Prisma relation chain)', 'sync-orders/route.ts: OrderItem includes Product (name)',
  syncOrdersHasOrderItem && syncOrdersHasProduct,
  syncOrdersHasOrderItem && syncOrdersHasProduct ? 'OrderItem.Product.select.name found' : 'NOT FOUND');

check('ITEM-03 (Prisma relation chain)', 'sync-orders/route.ts: OrderItem includes ProductVariant (sku, color, size)',
  syncOrdersHasOrderItem && syncOrdersHasVariant,
  syncOrdersHasOrderItem && syncOrdersHasVariant ? 'OrderItem.ProductVariant.select with sku, color, size found' : 'NOT FOUND');

// ITEM-04: _key on array items
const hasKey = /_key:\s*item\.id/.test(mapperContent);
check('ITEM-04 (_key on array items)', 'Mapper includes _key', hasKey,
  hasKey ? '_key: item.id' : 'NOT FOUND');

// Schema alignment check
const schemaPath = path.join(__dirname, '../../studio-grailseekers/schemaTypes/orderType.ts');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

const schemaHasName = /name:\s*"name"[\s\S]*?type:\s*"string"/.test(schemaContent);
check('SCHEMA ALIGNMENT', 'Sanity items schema has: name (string)', schemaHasName,
  schemaHasName ? 'name: string field found' : 'NOT FOUND');

const schemaHasSku = /name:\s*"sku"[\s\S]*?type:\s*"string"/.test(schemaContent);
check('SCHEMA ALIGNMENT', 'Sanity items schema has: sku (string)', schemaHasSku,
  schemaHasSku ? 'sku: string field found' : 'NOT FOUND');

const schemaHasColor = /name:\s*"color"[\s\S]*?type:\s*"string"/.test(schemaContent);
check('SCHEMA ALIGNMENT', 'Sanity items schema has: color (string)', schemaHasColor,
  schemaHasColor ? 'color: string field found' : 'NOT FOUND');

const schemaHasSize = /name:\s*"size"[\s\S]*?type:\s*"string"/.test(schemaContent);
check('SCHEMA ALIGNMENT', 'Sanity items schema has: size (string)', schemaHasSize,
  schemaHasSize ? 'size: string field found' : 'NOT FOUND');

const schemaHasQuantity = /name:\s*"quantity"[\s\S]*?type:\s*"number"/.test(schemaContent);
check('SCHEMA ALIGNMENT', 'Sanity items schema has: quantity (number)', schemaHasQuantity,
  schemaHasQuantity ? 'quantity: number field found' : 'NOT FOUND');

const schemaHasPrice = /name:\s*"price"[\s\S]*?type:\s*"number"/.test(schemaContent);
check('SCHEMA ALIGNMENT', 'Sanity items schema has: price (number)', schemaHasPrice,
  schemaHasPrice ? 'price: number field found' : 'NOT FOUND');

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

    // Fetch one order with items
    const query = '*[_type == "order" && defined(items) && count(items) > 0][0]{ _id, orderNumber, items }';
    const order = await sanityClient.fetch(query);

    if (!order || !order.items || order.items.length === 0) {
      info('LIVE DATA SAMPLING', 'No orders with items found', 'No data to sample');
      console.log('  [INFO] No orders with items found in Sanity\n');
      return;
    }

    const item = order.items[0];
    const orderNum = order.orderNumber || 'unknown';

    // Check _key
    const hasKeyField = typeof item._key === 'string' && item._key.length > 0;
    const keyStatus = hasKeyField ? 'PASS' : 'FAIL';
    const keyDetail = hasKeyField ? `_key="${item._key}"` : '_key missing or empty';
    console.log(`  [${keyStatus}] Sampled order ${orderNum}: item has ${keyDetail}`);
    if (keyStatus === 'PASS') passCount++; else failCount++;

    // Check name
    const hasNameField = typeof item.name === 'string' && item.name.length > 0;
    const nameStatus = hasNameField ? 'PASS' : 'FAIL';
    const nameDetail = hasNameField ? `name="${item.name}"` : 'name missing or empty';
    console.log(`  [${nameStatus}] Sampled order ${orderNum}: item has ${nameDetail}`);
    if (nameStatus === 'PASS') passCount++; else failCount++;

    // Check quantity
    const hasQuantityField = typeof item.quantity === 'number';
    const quantityStatus = hasQuantityField ? 'PASS' : 'FAIL';
    const quantityDetail = hasQuantityField ? `quantity=${item.quantity}` : 'quantity missing or wrong type';
    console.log(`  [${quantityStatus}] Sampled order ${orderNum}: item has ${quantityDetail}`);
    if (quantityStatus === 'PASS') passCount++; else failCount++;

    // Check price
    const hasPriceField = typeof item.price === 'number';
    const priceStatus = hasPriceField ? 'PASS' : 'FAIL';
    const priceDetail = hasPriceField ? `price=${item.price}` : 'price missing or wrong type';
    console.log(`  [${priceStatus}] Sampled order ${orderNum}: item has ${priceDetail}`);
    if (priceStatus === 'PASS') passCount++; else failCount++;

    // Check SKU, size, color (INFO only - these can be absent for products without variants)
    const skuDetail = item.sku ? `sku="${item.sku}"` : 'sku absent (OK if no variant)';
    console.log(`  [INFO] Sampled order ${orderNum}: item ${skuDetail}`);

    const sizeDetail = item.size ? `size="${item.size}"` : 'size absent (OK if no variant)';
    console.log(`  [INFO] Sampled order ${orderNum}: item ${sizeDetail}`);

    const colorDetail = item.color ? `color="${item.color}"` : 'color absent (OK if no variant)';
    console.log(`  [INFO] Sampled order ${orderNum}: item ${colorDetail}`);

    // Coverage stats
    const totalOrdersWithItems = await sanityClient.fetch('count(*[_type == "order" && defined(items) && count(items) > 0])');
    const ordersWithNames = await sanityClient.fetch('count(*[_type == "order" && defined(items[0].name)])');

    console.log(`  [INFO] Coverage: ${ordersWithNames}/${totalOrdersWithItems} orders have enriched item names\n`);

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
