import { uploadToS3, uploadLargeToS3, deleteFromS3, generateS3Key, getPublicUrl } from './s3';
import { ALLOWED_MIME_TYPES, LIMITS } from '@/config/constants';

interface UploadResult {
  path: string;
  url: string;
  size: number;
  mimeType: string;
}

type MediaType = 'image' | 'video' | 'avatar';

// Use multipart upload for files larger than 10MB
const MULTIPART_THRESHOLD = 10 * 1024 * 1024;

export async function uploadFile(
  file: File,
  type: MediaType,
  ownerId: string
): Promise<UploadResult> {
  // Validar tipo MIME
  const allowedTypes = ALLOWED_MIME_TYPES[type] as readonly string[];
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Tipo de arquivo não permitido: ${file.type}`);
  }

  // Validar tamanho
  const maxSize = type === 'video' ? LIMITS.MAX_VIDEO_SIZE :
                  type === 'avatar' ? LIMITS.MAX_AVATAR_SIZE : LIMITS.MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    throw new Error(`Arquivo muito grande. Máximo: ${maxSize / 1024 / 1024}MB`);
  }

  // Gerar path único
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const s3Type = type === 'avatar' ? 'avatar' : type;
  const s3Key = generateS3Key(ownerId, s3Type, ext);

  // Upload para S3 (usar multipart para arquivos grandes)
  const buffer = Buffer.from(await file.arrayBuffer());
  const url = file.size > MULTIPART_THRESHOLD
    ? await uploadLargeToS3(s3Key, buffer, file.type)
    : await uploadToS3(s3Key, buffer, file.type);

  return {
    path: s3Key,
    url,
    size: file.size,
    mimeType: file.type,
  };
}

export async function deleteFile(s3Key: string): Promise<void> {
  try {
    await deleteFromS3(s3Key);
  } catch (error) {
    console.error(`Failed to delete file from S3: ${s3Key}`, error);
  }
}

export async function getFileUrl(s3Key: string): Promise<string> {
  return getPublicUrl(s3Key);
}

export function isValidMediaType(mimeType: string, type: MediaType): boolean {
  const allowedTypes = ALLOWED_MIME_TYPES[type] as readonly string[];
  return allowedTypes.includes(mimeType);
}
