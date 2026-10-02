import { Activity, ValidatedCourse } from '../types';
import { CourseLoadError } from './course-load-error';
import { ResourceResolver } from './resource-resolver';

const INVALID_MANIFEST = 'The file is not a valid course manifest.';

function invalid(detail: string): CourseLoadError {
  return new CourseLoadError('manifest-invalid', `${INVALID_MANIFEST} ${detail}`, false);
}

function children(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter((child) => child.localName === name);
}

function descendants(parent: Element | Document, name: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS('*', name));
}

/** Parses `imsmanifest.xml` text into a validated course whose resource URLs sit under `root`. */
export function parseManifest(xml: string, root: URL): ValidatedCourse {
  if (/<!DOCTYPE/i.test(xml)) {
    throw invalid('Document type declarations are not allowed.');
  }
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0) {
    throw invalid('The XML is malformed.');
  }
  const resolver = new ResourceResolver(root);

  const organization = descendants(document, 'organization')[0];
  const resources = new Map(
    descendants(document, 'resource').map((resource) => [
      resource.getAttribute('identifier'),
      resource,
    ]),
  );

  const activities: Activity[] = descendants(organization, 'item').map((item) => {
    const resource = resources.get(item.getAttribute('identifierref'))!;
    const scormType =
      resource.getAttributeNS('*', 'scormtype') ?? resource.getAttribute('adlcp:scormtype');
    return {
      id: item.getAttribute('identifier')!,
      title: children(item, 'title')[0].textContent!.trim(),
      resource: {
        kind: scormType === 'sco' ? 'sco' : 'asset',
        url: resolver.resolve(resource.getAttribute('href')!).href,
      },
    };
  });

  return {
    edition: '1.2',
    title: children(organization, 'title')[0].textContent!.trim(),
    activities,
  };
}
