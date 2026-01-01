/**
 * Script to verify and setup S3 bucket for Wasabi
 * Run with: bun run src/scripts/setup-s3.ts
 */

import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { env } from '../config/env';

const s3Client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

const BUCKET = env.S3_BUCKET;

async function checkBucketExists(): Promise<boolean> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return true;
  } catch {
    return false;
  }
}

async function createBucket(): Promise<void> {
  console.log(`Creating bucket: ${BUCKET}...`);

  await s3Client.send(
    new CreateBucketCommand({
      Bucket: BUCKET,
    })
  );

  // Set bucket policy for public read access
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadGetObject',
        Effect: 'Allow',
        Principal: '*',
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${BUCKET}/*`,
      },
    ],
  };

  await s3Client.send(
    new PutBucketPolicyCommand({
      Bucket: BUCKET,
      Policy: JSON.stringify(policy),
    })
  );

  console.log(`Bucket ${BUCKET} created with public read policy!`);
}

async function main() {
  console.log('Checking Wasabi S3 configuration...');
  console.log(`Endpoint: ${env.S3_ENDPOINT}`);
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Region: ${env.S3_REGION}`);

  const exists = await checkBucketExists();

  if (exists) {
    console.log(`✅ Bucket "${BUCKET}" already exists and is accessible.`);
  } else {
    console.log(`⚠️ Bucket "${BUCKET}" not found. Creating...`);
    try {
      await createBucket();
      console.log(`✅ Bucket "${BUCKET}" created successfully!`);
    } catch (error) {
      console.error('❌ Failed to create bucket:', error);
      process.exit(1);
    }
  }

  // Test upload
  console.log('\nTesting upload...');
  const testKey = 'test/connection-test.txt';
  const testContent = `Test upload at ${new Date().toISOString()}`;

  try {
    const { PutObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: testKey,
        Body: testContent,
        ContentType: 'text/plain',
        ACL: 'public-read',
      })
    );

    const testUrl = `${env.S3_ENDPOINT}/${BUCKET}/${testKey}`;
    console.log(`✅ Test upload successful!`);
    console.log(`   URL: ${testUrl}`);

    // Clean up test file
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: testKey,
      })
    );
    console.log(`✅ Test file cleaned up.`);
  } catch (error) {
    console.error('❌ Upload test failed:', error);
    process.exit(1);
  }

  console.log('\n🎉 S3 setup verified successfully!');
}

main().catch(console.error);
