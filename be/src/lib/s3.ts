import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { env } from '@/config/env';

// Initialize S3 client for Wasabi
export const s3Client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

export const BUCKET = env.S3_BUCKET;

// 7 days in seconds (maximum allowed by S3 signature v4)
const SIGNED_URL_EXPIRY = 7 * 24 * 60 * 60; // 604800 seconds

// Generate a signed URL for accessing a file (valid for 50 years)
export async function getSignedFileUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: SIGNED_URL_EXPIRY });
}

// Upload a file to S3 and return the signed URL
export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array | Blob | ReadableStream,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Return signed URL for accessing the file
  return getSignedFileUrl(key);
}

// Upload large files with multipart upload
export async function uploadLargeToS3(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
    queueSize: 4,
    partSize: 5 * 1024 * 1024, // 5MB parts
  });

  await upload.done();

  // Return signed URL for accessing the file
  return getSignedFileUrl(key);
}

// Delete a file from S3
export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  await s3Client.send(command);
}

// Check if a file exists
export async function existsInS3(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch {
    return false;
  }
}

// Get a file from S3
export async function getFromS3(key: string): Promise<ReadableStream | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    const response = await s3Client.send(command);
    return response.Body as ReadableStream;
  } catch {
    return null;
  }
}

// Generate a unique key for uploads
export function generateS3Key(
  userId: string,
  type: 'image' | 'video' | 'avatar' | 'story',
  extension: string
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${type}s/${userId}/${timestamp}-${random}.${extension}`;
}

// Get public URL (legacy - now returns signed URL)
export async function getPublicUrl(key: string): Promise<string> {
  return getSignedFileUrl(key);
}
