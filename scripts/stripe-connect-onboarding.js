// Stripe Connect Onboarding Script
// Creates a Stripe Connect Express account and generates an onboarding link
// Usage: node scripts/stripe-connect-onboarding.js --email client@example.com --business-name "Client Business"

require('dotenv').config({ path: '.env' });
const Stripe = require('stripe');

// Validate Stripe key
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ ERROR: STRIPE_SECRET_KEY not found in .env file');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const email = getArg('--email');
const businessName = getArg('--business-name') || 'Connected Account';
const country = getArg('--country') || 'US';

if (!email) {
  console.error('❌ ERROR: --email parameter is required');
  console.log('\nUsage:');
  console.log('  node scripts/stripe-connect-onboarding.js --email client@example.com --business-name "Client Business"');
  console.log('\nOptions:');
  console.log('  --email           (required) Client\'s email address');
  console.log('  --business-name   (optional) Business name (default: "Connected Account")');
  console.log('  --country         (optional) Country code (default: "US")');
  process.exit(1);
}

async function createConnectedAccount() {
  console.log('=== Stripe Connect Onboarding ===\n');
  console.log('Creating connected account for:');
  console.log('  Email:', email);
  console.log('  Business Name:', businessName);
  console.log('  Country:', country);
  console.log('');

  try {
    // Step 1: Create a Connect Express account
    console.log('1. Creating Stripe Connect Express account...');
    const account = await stripe.accounts.create({
      type: 'express',
      country: country,
      email: email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual', // or 'company' depending on client
      business_profile: {
        name: businessName,
      },
    });

    console.log('   ✅ Account created successfully!');
    console.log('   Account ID:', account.id);
    console.log('');

    // Step 2: Create an Account Link for onboarding
    console.log('2. Generating onboarding link...');
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'https://yourplatform.com/connect/refresh', // URL if they need to restart
      return_url: 'https://yourplatform.com/connect/complete', // URL after completion
      type: 'account_onboarding',
    });

    console.log('   ✅ Onboarding link generated!');
    console.log('');

    // Step 3: Display results
    console.log('=== SUCCESS! ===\n');
    console.log('📧 Send this onboarding link to your client:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(accountLink.url);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('⏱️  This link expires in 24 hours');
    console.log('');
    console.log('🔑 Save this Connected Account ID:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(account.id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Send the onboarding link to your client');
    console.log('   2. Wait for them to complete onboarding');
    console.log('   3. Run: node scripts/check-connect-status.js', account.id);
    console.log('   4. Once verified, add to .env:');
    console.log(`      STRIPE_CONNECTED_ACCOUNT_ID=${account.id}`);
    console.log('');

    // Save to a temporary file for reference
    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `stripe-connect-${account.id}-${timestamp}.txt`;

    const content = `Stripe Connect Account Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Created: ${new Date().toISOString()}
Email: ${email}
Business Name: ${businessName}
Country: ${country}

Connected Account ID:
${account.id}

Onboarding Link (expires in 24h):
${accountLink.url}

Status: Pending onboarding completion

Next Steps:
1. Send the onboarding link to ${email}
2. Wait for onboarding completion
3. Check status: node scripts/check-connect-status.js ${account.id}
4. Add to .env: STRIPE_CONNECTED_ACCOUNT_ID=${account.id}
`;

    fs.writeFileSync(filename, content);
    console.log(`💾 Details saved to: ${filename}`);
    console.log('');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.param) {
      console.error('   Parameter:', error.param);
    }
    console.error('');
    console.error('💡 Common issues:');
    console.error('   - Make sure STRIPE_SECRET_KEY is set in .env');
    console.error('   - Verify the email address is valid');
    console.error('   - Check that Stripe Connect is enabled in your account');
    process.exit(1);
  }
}

createConnectedAccount();
