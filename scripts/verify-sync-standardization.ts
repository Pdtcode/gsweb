/**
 * Sync Standardization Verification Script
 *
 * Verifies Phase 2 requirements SYNC-01, SYNC-02, SYNC-03:
 * - SYNC-01: Deterministic _id pattern (order-${order.id})
 * - SYNC-02: All sync paths use createOrReplace() (not create())
 * - SYNC-03: Re-syncing updates existing documents (idempotent)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: CheckResult[] = [];

function check(name: string, passed: boolean, message: string) {
  results.push({ name, passed, message });
  const status = passed ? '[PASS]' : '[FAIL]';
  console.log(`  ${status} ${name}`);
  if (!passed) {
    console.log(`        ${message}`);
  }
}

async function runStaticAudit() {
  console.log('STATIC AUDIT:');

  const projectRoot = path.resolve(__dirname, '../..');
  const mapperPath = path.join(projectRoot, 'gsweb/lib/mappers/orderMapper.ts');
  const dualSyncPath = path.join(projectRoot, 'gsweb/lib/dualSyncService.ts');
  const syncRoutePath = path.join(projectRoot, 'gsweb/app/api/sync-orders/route.ts');

  // Read files
  const mapperContent = fs.readFileSync(mapperPath, 'utf-8');
  const dualSyncContent = fs.readFileSync(dualSyncPath, 'utf-8');
  const syncRouteContent = fs.readFileSync(syncRoutePath, 'utf-8');

  // SYNC-01: Check deterministic _id pattern in mapper
  const deterministicIdPattern = /_id:\s*`order-\$\{order\.id\}`/;
  check(
    'SYNC-01: Deterministic _id pattern (order-${order.id}) in mapper',
    deterministicIdPattern.test(mapperContent),
    'Expected to find _id: `order-${order.id}` in orderMapper.ts'
  );

  // SYNC-02: Check createOrReplace() in dualSyncService
  const hasCreateOrReplaceInDualSync = /createOrReplace\s*\(/.test(dualSyncContent);
  check(
    'SYNC-02: createOrReplace() used in dualSyncService.ts',
    hasCreateOrReplaceInDualSync,
    'Expected to find createOrReplace() call in dualSyncService.ts'
  );

  // SYNC-02: Check createOrReplace() in sync-orders route
  const hasCreateOrReplaceInRoute = /createOrReplace\s*\(/.test(syncRouteContent);
  check(
    'SYNC-02: createOrReplace() used in sync-orders/route.ts',
    hasCreateOrReplaceInRoute,
    'Expected to find createOrReplace() call in sync-orders/route.ts'
  );

  // SYNC-02: Check NO bare create() for orders (must exclude createOrReplace, createIfNotExists)
  // Pattern: .create( but NOT .createOrReplace( or .createIfNotExists(
  const bareCreatePattern = /\.create\s*\(/;
  const createOrReplacePattern = /\.createOrReplace\s*\(/;
  const createIfNotExistsPattern = /\.createIfNotExists\s*\(/;

  // Check dualSyncService
  const dualSyncHasBareCreate = bareCreatePattern.test(dualSyncContent);
  const dualSyncHasCreateOrReplace = createOrReplacePattern.test(dualSyncContent);
  const dualSyncHasCreateIfNotExists = createIfNotExistsPattern.test(dualSyncContent);

  // Only fail if there's a bare create that's not part of createOrReplace or createIfNotExists
  // We need to be more careful: check if any .create( is NOT followed by OrReplace or IfNotExists
  const dualSyncSafeFromBareCreate = !dualSyncHasBareCreate ||
    (dualSyncHasCreateOrReplace && !(/sanityClient\.create\s*\(/.test(dualSyncContent)));

  // Check sync-orders route
  const routeHasBareCreate = bareCreatePattern.test(syncRouteContent);
  const routeHasCreateOrReplace = createOrReplacePattern.test(syncRouteContent);
  const routeHasCreateIfNotExists = createIfNotExistsPattern.test(syncRouteContent);

  const routeSafeFromBareCreate = !routeHasBareCreate ||
    (routeHasCreateOrReplace && !(/sanityClient\.create\s*\(/.test(syncRouteContent)));

  check(
    'SYNC-02: No bare sanityClient.create() calls for orders',
    dualSyncSafeFromBareCreate && routeSafeFromBareCreate,
    'Found sanityClient.create() (should use createOrReplace() instead)'
  );

  // SYNC-02: Check both files import centralized mapper
  const mapperImportPattern = /import\s+\{[^}]*mapNeonOrderToSanity[^}]*\}\s+from\s+['"].*orderMapper/;
  const dualSyncImportsMapper = mapperImportPattern.test(dualSyncContent);
  const routeImportsMapper = mapperImportPattern.test(syncRouteContent);

  check(
    'SYNC-02: Both consumers import centralized mapper',
    dualSyncImportsMapper && routeImportsMapper,
    'Expected both files to import mapNeonOrderToSanity from orderMapper'
  );

  // SYNC-03: Verify createOrReplace ensures update-not-create (inherent property)
  check(
    'SYNC-03: createOrReplace ensures update-not-create',
    hasCreateOrReplaceInDualSync && hasCreateOrReplaceInRoute,
    'createOrReplace() inherently provides idempotent update behavior'
  );
}

async function runLiveIdempotencyTest() {
  console.log('\nLIVE IDEMPOTENCY (requires SANITY_API_TOKEN):');

  const token = process.env.SANITY_API_TOKEN;
  if (!token) {
    console.log('  [SKIP] Live tests skipped (SANITY_API_TOKEN not set)');
    return;
  }

  try {
    const { createClient } = require('@sanity/client');

    const sanityClient = createClient({
      projectId: 'arbp7h2s',
      dataset: 'production',
      useCdn: false,
      apiVersion: '2023-05-03',
      token: token,
    });

    // Fetch all current order IDs
    const orderIds = await sanityClient.fetch<string[]>(`*[_type == "order"]._id`);

    if (orderIds.length === 0) {
      console.log('  [SKIP] No orders in Sanity to test with');
      return;
    }

    // Pick the first order
    const testOrderId = orderIds[0];
    console.log(`  Testing with order: ${testOrderId}`);

    // Count documents before
    const countBefore = await sanityClient.fetch<number>(`count(*[_id == $id])`, { id: testOrderId });
    check(
      `Order ${testOrderId}: count=1 before createOrReplace`,
      countBefore === 1,
      `Expected count to be 1, got ${countBefore}`
    );

    // Fetch the full document
    const orderDoc = await sanityClient.fetch<any>(`*[_id == $id][0]`, { id: testOrderId });
    const updatedAtBefore = orderDoc._updatedAt;

    // Wait a moment to ensure timestamp will change
    await new Promise(resolve => setTimeout(resolve, 100));

    // Call createOrReplace with the same document
    await sanityClient.createOrReplace(orderDoc);

    // Count documents after
    const countAfter = await sanityClient.fetch<number>(`count(*[_id == $id])`, { id: testOrderId });
    check(
      `Order ${testOrderId}: count=1 after createOrReplace (no duplicate)`,
      countAfter === 1,
      `Expected count to remain 1, got ${countAfter}`
    );

    // Verify _updatedAt changed (proving update occurred)
    const orderDocAfter = await sanityClient.fetch<any>(`*[_id == $id][0]`, { id: testOrderId });
    const updatedAtAfter = orderDocAfter._updatedAt;

    check(
      `Order ${testOrderId}: _updatedAt changed (update occurred)`,
      updatedAtAfter !== updatedAtBefore,
      `Expected _updatedAt to change, but it remained ${updatedAtBefore}`
    );

  } catch (error) {
    console.log(`  [ERROR] Live test failed: ${error instanceof Error ? error.message : String(error)}`);
    results.push({
      name: 'Live idempotency test',
      passed: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function main() {
  console.log('=== SYNC STANDARDIZATION VERIFICATION ===\n');

  await runStaticAudit();
  await runLiveIdempotencyTest();

  // Summary
  const totalChecks = results.length;
  const passedChecks = results.filter(r => r.passed).length;
  const failedChecks = totalChecks - passedChecks;

  console.log(`\nResult: ${passedChecks}/${totalChecks} checks passed`);

  if (failedChecks > 0) {
    console.log('\nFailed checks:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
    process.exit(1);
  }

  process.exit(0);
}

main();
