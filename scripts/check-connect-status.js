// Check Stripe Connect Account Status
// Usage: node scripts/check-connect-status.js [account_id]
// If no account_id provided, uses STRIPE_CONNECTED_ACCOUNT_ID from .env

require('dotenv').config({ path: '.env' });
const Stripe = require('stripe');

// Validate Stripe key
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ ERROR: STRIPE_SECRET_KEY not found in .env file');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Get account ID from command line or .env
const accountId = process.argv[2] || process.env.STRIPE_CONNECTED_ACCOUNT_ID;

if (!accountId) {
  console.error('❌ ERROR: No account ID provided');
  console.log('\nUsage:');
  console.log('  node scripts/check-connect-status.js acct_xxxxx');
  console.log('  OR set STRIPE_CONNECTED_ACCOUNT_ID in .env and run:');
  console.log('  node scripts/check-connect-status.js');
  process.exit(1);
}

async function checkAccountStatus() {
  console.log('=== Stripe Connect Account Status ===\n');
  console.log('Checking account:', accountId);
  console.log('');

  try {
    // Retrieve the account
    const account = await stripe.accounts.retrieve(accountId);

    console.log('📊 Account Information:');
    console.log('   Account ID:', account.id);
    console.log('   Type:', account.type);
    console.log('   Email:', account.email || 'Not provided');
    console.log('   Country:', account.country);
    console.log('   Business Name:', account.business_profile?.name || 'Not set');
    console.log('');

    // Check charges enabled status
    console.log('💳 Charges Status:');
    if (account.charges_enabled) {
      console.log('   ✅ ENABLED - This account can accept charges');
    } else {
      console.log('   ❌ DISABLED - This account cannot accept charges yet');
    }
    console.log('');

    // Check payouts enabled status
    console.log('💰 Payouts Status:');
    if (account.payouts_enabled) {
      console.log('   ✅ ENABLED - This account can receive payouts');
    } else {
      console.log('   ❌ DISABLED - This account cannot receive payouts yet');
    }
    console.log('');

    // Check details submitted
    console.log('📝 Onboarding Status:');
    if (account.details_submitted) {
      console.log('   ✅ COMPLETE - Account has completed onboarding');
    } else {
      console.log('   ⏳ INCOMPLETE - Account needs to complete onboarding');
    }
    console.log('');

    // Check requirements
    if (account.requirements) {
      const {
        currently_due,
        eventually_due,
        past_due,
        pending_verification,
        disabled_reason
      } = account.requirements;

      if (disabled_reason) {
        console.log('⚠️  Account Disabled:');
        console.log('   Reason:', disabled_reason);
        console.log('');
      }

      if (currently_due && currently_due.length > 0) {
        console.log('⚠️  Currently Due Requirements:');
        currently_due.forEach(req => console.log('   -', req));
        console.log('');
      }

      if (past_due && past_due.length > 0) {
        console.log('❌ Past Due Requirements:');
        past_due.forEach(req => console.log('   -', req));
        console.log('');
      }

      if (pending_verification && pending_verification.length > 0) {
        console.log('⏳ Pending Verification:');
        pending_verification.forEach(req => console.log('   -', req));
        console.log('');
      }
    }

    // Check capabilities
    console.log('🔧 Capabilities:');
    if (account.capabilities) {
      Object.entries(account.capabilities).forEach(([capability, status]) => {
        const icon = status === 'active' ? '✅' : status === 'inactive' ? '❌' : '⏳';
        console.log(`   ${icon} ${capability}: ${status}`);
      });
    }
    console.log('');

    // Overall status summary
    console.log('=== Summary ===');
    if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
      console.log('✅ READY FOR PRODUCTION');
      console.log('   This account is fully set up and can process payments!');
      console.log('');
      console.log('📝 Next step: Add to your .env file:');
      console.log(`   STRIPE_CONNECTED_ACCOUNT_ID=${account.id}`);
    } else if (!account.details_submitted) {
      console.log('⏳ ONBOARDING INCOMPLETE');
      console.log('   The client needs to complete the onboarding process.');
      console.log('');
      console.log('💡 To generate a new onboarding link:');
      console.log(`   node scripts/stripe-connect-onboarding.js --email ${account.email || 'client@example.com'}`);
    } else {
      console.log('⚠️  SETUP IN PROGRESS');
      console.log('   The account is being processed by Stripe.');
      console.log('   Check again in a few hours or contact Stripe support.');
    }
    console.log('');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.code === 'resource_missing') {
      console.error('   The account ID does not exist or you don\'t have access to it.');
    }
    if (error.code === 'account_invalid') {
      console.error('   The account ID is invalid or has been deleted.');
    }
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   - Verify the account ID is correct');
    console.error('   - Make sure you\'re using the right Stripe API key (test vs live)');
    console.error('   - Check that the account was created with this Stripe account');
    process.exit(1);
  }
}

checkAccountStatus();
