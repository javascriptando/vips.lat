import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { env } from '@/config/env';
import { generateId } from './utils';
import { ALLOWED_MIME_TYPES, LIMITS } from '@/config/constants';

const UPLOAD_DIR = env.UPLOAD_DIR;

interface UploadResult {
  path: string;
  url: string;
  size: number;
  mimeType: string;
}

type MediaType = 'image' | 'video' | 'avatar';

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
  const filename = `${generateId()}.${ext}`;
  const folder = type === 'avatar' ? 'avatars' : `${type}s`;
  const relativePath = `${folder}/${ownerId}/${filename}`;
  const fullPath = join(UPLOAD_DIR, relativePath);

  // Criar diretório se não existir
  await mkdir(dirname(fullPath), { recursive: true });

  // Salvar arquivo
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);

  return {
    path: relativePath,
    url: `/uploads/${relativePath}`,
    size: file.size,
    mimeType: file.type,
  };
}

export async function deleteFile(relativePath: string): Promise<void> {
  const fullPath = join(UPLOAD_DIR, relativePath);
  try {
    await unlink(fullPath);
  } catch (error) {
    // Ignora erro se arquivo não existir
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`Failed to delete file: ${fullPath}`, error);
    }
  }
}

export function getFilePath(relativePath: string): string {
  return join(UPLOAD_DIR, relativePath);
}

export function isValidMediaType(mimeType: string, type: MediaType): boolean {
  const allowedTypes = ALLOWED_MIME_TYPES[type] as readonly string[];
  return allowedTypes.includes(mimeType);
}
