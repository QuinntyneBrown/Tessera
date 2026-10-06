import { Activity, CourseNode, ValidatedCourse } from '../types';
import { parseSequencing } from './sequencing-parser';
import { CourseLoadError } from './course-load-error';
import { detectEdition } from './edition';
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
  const resolver = new ResourceResolver(root);

  const organization = descendants(document, 'organization')[0];
  const resources = new Map(
    descendants(document, 'resource').map((resource) => [
      resource.getAttribute('identifier'),
      resource,
    ]),
  );

  const node = (element: Element): CourseNode => {
    const items = children(element, 'item');
    const resource = resources.get(element.getAttribute('identifierref'));
    const id = element.getAttribute('identifier')!;
    const title = children(element, 'title')[0].textContent!.trim();
    const sequencing = parseSequencing(children(element, 'sequencing')[0], edition);
    if (items.length > 0 || !resource) {
      return { id, title, children: items.map(node), sequencing };
    }
    // SCORM 1.2 spells the attribute adlcp:scormtype; SCORM 2004 spells it adlcp:scormType.
    const scormType = Array.from(resource.attributes).find(
      (attribute) => attribute.localName.toLowerCase() === 'scormtype',
    )?.value;
    const activity: Activity = {
      id,
      title,
      resource: {
        kind: scormType === 'sco' ? 'sco' : 'asset',
        url: resolver.resolve(resource.getAttribute('href')!).href,
      },
    };
    return { id, title, activity, children: [], sequencing };
  };
  const tree = node(organization);
  const activities: Activity[] = [];
  const collect = (each: CourseNode): void => {
    if (each.activity) activities.push(each.activity);
    each.children.forEach(collect);
  };
  collect(tree);
  return { edition, root: root.href, title: tree.title, activities, tree };
}
