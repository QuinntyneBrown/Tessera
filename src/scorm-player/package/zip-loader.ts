import { unzip } from 'fflate';
import { PackageLimits, ValidatedCourse } from '../types';
import { CourseLoadError } from './course-load-error';
import { parseManifest } from './manifest-parser';
import { ResourceResolver } from './resource-resolver';

/** Where a package's files notionally live while it is validated; the host serves them elsewhere. */
const PACKAGE_ROOT = new URL('https://package.invalid/course/');

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  js: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  woff2: 'font/woff2',
};

const contentType = (name: string) =>
  CONTENT_TYPES[name.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream';

function limitExceeded(limit: string): CourseLoadError {
  return new CourseLoadError('limit-exceeded', `The package exceeds the ${limit} limit.`, false);
}

/** Extracts a ZIP off the main thread (fflate runs it in a worker) while enforcing the host's limits. */
function extract(
  data: Uint8Array,
  limits: PackageLimits,
  signal: AbortSignal,
): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    let entries = 0;
    let expanded = 0;
    let exceeded: string | null = null;
    const terminate = unzip(
      data,
      {
        filter: (entry) => {
          if (++entries > limits.entryCount) exceeded ??= 'entry count';
          expanded += entry.originalSize;
          if (expanded > limits.expandedBytes) exceeded ??= 'expanded size';
          return !exceeded && !entry.name.endsWith('/');
        },
      },
      (error, files) => {
        if (exceeded) return reject(limitExceeded(exceeded));
        if (error) {
          return reject(
            new CourseLoadError(
              'archive-invalid',
              'The package is not a valid ZIP archive.',
              false,
            ),
          );
        }
        const actual = Object.values(files).reduce((sum, file) => sum + file.length, 0);
        if (actual > limits.expandedBytes) return reject(limitExceeded('expanded size'));
        resolve(files);
      },
    );
    signal.addEventListener('abort', () => {
      terminate();
      reject(signal.reason);
    });
  });
}

export async function loadZip(
  file: File,
  limits: PackageLimits,
  signal: AbortSignal,
): Promise<ValidatedCourse> {
  if (file.size > limits.archiveBytes) throw limitExceeded('archive size');
  const data = new Uint8Array(await file.arrayBuffer());
  signal.throwIfAborted();
  const files = await extract(data, limits, signal);

  const resolver = new ResourceResolver(PACKAGE_ROOT);
  for (const name of Object.keys(files)) resolver.resolve(name);

  const manifest = files['imsmanifest.xml'];
  if (!manifest) {
    throw new CourseLoadError(
      'manifest-missing',
      'The package has no imsmanifest.xml at its root.',
      false,
    );
  }
  const course = parseManifest(new TextDecoder().decode(manifest), PACKAGE_ROOT);
  for (const { resource } of course.activities) {
    const path = decodeURIComponent(
      new URL(resource.url).pathname.slice(PACKAGE_ROOT.pathname.length),
    );
    if (!files[path]) {
      throw new CourseLoadError(
        'launch-resource-missing',
        `The package does not contain ${path}.`,
        false,
      );
    }
  }
  const blobs = new Map(
    Object.entries(files).map(([name, bytes]) => [
      name,
      new Blob([bytes as BlobPart], { type: contentType(name) }),
    ]),
  );
  return { ...course, files: blobs };
}
