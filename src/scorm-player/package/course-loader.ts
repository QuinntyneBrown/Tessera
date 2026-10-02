import { CourseSource, ValidatedCourse } from '../types';
import { CourseLoadError } from './course-load-error';
import { parseManifest } from './manifest-parser';

const MANIFEST_UNREACHABLE =
  'The course manifest could not be fetched. Check your connection and try again.';

export async function loadCourse(
  source: CourseSource,
  signal: AbortSignal,
): Promise<ValidatedCourse> {
  if (source.kind !== 'manifest') {
    throw new Error('ZIP sources are not supported yet');
  }
  let response: Response;
  try {
    response = await fetch(source.manifestUrl, { signal });
  } catch (cause) {
    if (signal.aborted) throw cause;
    throw new CourseLoadError('manifest-unreachable', MANIFEST_UNREACHABLE, true);
  }
  if (!response.ok) {
    throw new CourseLoadError('manifest-unreachable', MANIFEST_UNREACHABLE, true);
  }
  return parseManifest(await response.text(), new URL('.', source.manifestUrl));
}
