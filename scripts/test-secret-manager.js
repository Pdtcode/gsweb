// Test Secret Manager connection
require('dotenv').config({ path: '.env' });
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

async function testSecretManager() {
  console.log('=== Testing Secret Manager ===\n');

  // Check environment variables
  console.log('1. Checking environment variables:');
  const hasSplitCreds = !!process.env.GCP_SERVICE_ACCOUNT_EMAIL && !!process.env.GCP_SERVICE_ACCOUNT_PRIVATE_KEY;
  const hasFullCreds = !!process.env.NETLIFY_SECRET_READER_CREDENTIALS;

  console.log('   GCP_SERVICE_ACCOUNT_EMAIL:', !!process.env.GCP_SERVICE_ACCOUNT_EMAIL);
  console.log('   GCP_SERVICE_ACCOUNT_PRIVATE_KEY:', !!process.env.GCP_SERVICE_ACCOUNT_PRIVATE_KEY);
  console.log('   GOOGLE_CLOUD_PROJECT_ID:', process.env.GOOGLE_CLOUD_PROJECT_ID);
  console.log('');

  if (!hasSplitCreds && !hasFullCreds) {
    console.error('❌ Secret Manager credentials not found in .env');
    console.log('\n💡 For local development, you have 2 options:');
    console.log('   Option 1 (Recommended): Add GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY directly');
    console.log('   Option 2 (Testing): Add GCP_SERVICE_ACCOUNT_EMAIL and GCP_SERVICE_ACCOUNT_PRIVATE_KEY\n');
    return;
  }

  try {
    // Parse credentials (support both split and full)
    console.log('2. Loading service account credentials...');
    let credentials;

    if (hasSplitCreds) {
      console.log('   Using split credentials approach');
      credentials = {
        client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GCP_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
      console.log('   ✅ Service account:', credentials.client_email);
    } else {
      console.log('   Using full JSON credentials');
      credentials = JSON.parse(process.env.NETLIFY_SECRET_READER_CREDENTIALS);
      console.log('   ✅ Service account:', credentials.client_email);
      console.log('   ✅ Project ID from credentials:', credentials.project_id);
    }
    console.log('');

    // Initialize client
    console.log('3. Initializing Secret Manager client...');
    const client = new SecretManagerServiceClient({
      credentials: credentials,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
    console.log('   ✅ Client initialized');
    console.log('');

    // Test accessing the secret
    console.log('4. Attempting to access secret...');
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const secretName = 'google-service-account-private-key';
    const secretPath = `projects/${projectId}/secrets/${secretName}/versions/latest`;

    console.log('   Secret path:', secretPath);
    console.log('');

    const [version] = await client.accessSecretVersion({
      name: secretPath,
    });

    const secretValue = version.payload.data.toString();
    console.log('   ✅ Secret accessed successfully!');
    console.log('   ✅ Secret length:', secretValue.length, 'characters');
    console.log('   ✅ Starts with:', secretValue.substring(0, 30) + '...');
    console.log('');

    console.log('🎉 SUCCESS! Secret Manager is working correctly!\n');

    // Test the other secret too
    console.log('5. Testing firebase-service-account-private-key...');
    const fbSecretPath = `projects/${projectId}/secrets/firebase-service-account-private-key/versions/latest`;
    try {
      const [fbVersion] = await client.accessSecretVersion({
        name: fbSecretPath,
      });
      const fbSecretValue = fbVersion.payload.data.toString();
      console.log('   ✅ Firebase secret accessed successfully!');
      console.log('   ✅ Secret length:', fbSecretValue.length, 'characters');console.log('   ✅ Starts with:', secretValue.substring(0, 30) + '...');
      console.log('');
    } catch (fbError) {
      console.log('   ⚠️ Firebase secret not found (optional for email testing)');
      console.log('');
    }

    return true;
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('   Error code:', error.code);
    console.error('');

    if (error.code === 5) {
      console.log('💡 Troubleshooting "NOT_FOUND" error:');
      console.log('');
      console.log('   1. Check which project has the secret:');
      console.log('      gcloud secrets list --project=grailseekers-1f236');
      console.log('      gcloud secrets list --project=gsweb-order-confirmation');
      console.log('');
      console.log('   2. Your current GOOGLE_CLOUD_PROJECT_ID:', process.env.GOOGLE_CLOUD_PROJECT_ID);
      console.log('      The secret might be in a different project!');
      console.log('');
      console.log('   3. If secret is in gsweb-order-confirmation, update .env:');
      console.log('      GOOGLE_CLOUD_PROJECT_ID=gsweb-order-confirmation');
      console.log('');
      console.log('   4. Create the secret if it doesn\'t exist:');
      console.log('      echo -n "YOUR_PRIVATE_KEY" | gcloud secrets create google-service-account-private-key \\');
      console.log('        --data-file=- \\');
      console.log('        --replication-policy="automatic" \\');
      console.log(`        --project=${process.env.GOOGLE_CLOUD_PROJECT_ID}`);
      console.log('');
    } else if (error.code === 7) {
      console.log('💡 Troubleshooting "PERMISSION_DENIED" error:');
      console.log('');
      console.log('   Grant access to the service account:');
      console.log('   gcloud secrets add-iam-policy-binding google-service-account-private-key \\');
      console.log('     --member="serviceAccount:netlify-secret-reader@grailseekers-1f236.iam.gserviceaccount.com" \\');
      console.log('     --role="roles/secretmanager.secretAccessor" \\');
      console.log(`     --project=${process.env.GOOGLE_CLOUD_PROJECT_ID}`);
      console.log('');
    } else {
      console.log('💡 Other error - check the error message above for details');
      console.log('');
    }

    return false;
  }
}

testSecretManager().catch(console.error);
