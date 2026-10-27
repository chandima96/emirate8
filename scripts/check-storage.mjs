import 'dotenv/config';
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

const required = ['S3_BUCKET', 'S3_REGION', 'S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
let invalid = false;
for (const name of required) {
  const value = process.env[name];
  if (!value || value !== value.trim()) {
    console.error(`${name}: ${value ? 'contains leading or trailing whitespace' : 'missing'}`);
    invalid = true;
  }
}
for (const name of ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
  if (/^(eyJ|sb_secret_|sb_publishable_)/.test(process.env[name] || '')) {
    console.error(`${name}: appears to be a Supabase API key; use the generated S3 credential pair.`);
    invalid = true;
  }
}

if (invalid) {
  process.exitCode = 1;
} else {
  const client = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
    forcePathStyle: true,
    maxAttempts: 1,
  });
  try {
    await client.send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET, MaxKeys: 1 }));
    console.log('Storage authentication and bucket access succeeded. No files were changed.');
  } catch (error) {
    console.error(`Storage check failed: ${error.name} (HTTP ${error.$metadata?.httpStatusCode || 'unknown'}).`);
    if (error.name === 'SignatureDoesNotMatch') {
      console.error('Copy the matching Access Key ID, Secret Access Key, endpoint, and region from this project\'s Supabase Storage S3 settings into .env, then restart Next.js.');
    }
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
}
