import { CourseSource, ValidatedCourse } from '../types';
import { parseManifest } from './manifest-parser';

export async function loadCourse(
  source: CourseSource,
  signal: AbortSignal,
): Promise<ValidatedCourse> {
  if (source.kind !== 'manifest') {
    throw new Error('ZIP sources are not supported yet');
  }
  const response = await fetch(source.manifestUrl, { signal });
  return parseManifest(await response.text(), new URL('.', source.manifestUrl));
}
