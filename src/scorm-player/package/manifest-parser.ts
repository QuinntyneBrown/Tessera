import { Activity, ValidatedCourse } from '../types';
import { CourseLoadError } from './course-load-error';
import { detectEdition, EDITION_LABELS, LAUNCHABLE_EDITIONS } from './edition';
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
  const edition = detectEdition(document);
  if (!edition) {
    throw new CourseLoadError(
      'edition-unidentified',
      'The SCORM version of this course could not be identified.',
      false,
    );
  }
  if (!LAUNCHABLE_EDITIONS.includes(edition)) {
    throw new CourseLoadError(
      'edition-unavailable',
      `This is a ${EDITION_LABELS[edition]} course. It cannot be launched because this player does not yet support that edition.`,
      false,
    );
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
    edition,
    root: root.href,
    title: children(organization, 'title')[0].textContent!.trim(),
    activities,
  };
}
