import { stat } from 'node:fs/promises';
import path from 'node:path';
import { mediaDisplayURL } from '../mediaURL';

// Only expose files inside the bundled public image directory.
export async function getBundledMediaPath(sourcePath: unknown): Promise<string | null> {
  if (typeof sourcePath !== 'string' || !sourcePath || sourcePath.includes('\\')) return null;
  if (sourcePath.split('/').some((part) => !part || part === '.' || part === '..')) return null;
  const root = path.resolve(process.cwd(), 'public/images');
  const filePath = path.resolve(root, sourcePath);
  if (!filePath.startsWith(`${root}${path.sep}`)) return null;
  try {
    return (await stat(filePath)).isFile() ? filePath : null;
  } catch {
    return null;
  }
}

export function bundledMediaURL(sourcePath: string): string {
  return mediaDisplayURL(`/images/${sourcePath.split('/').map(encodeURIComponent).join('/')}`);
}
