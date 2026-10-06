import { parseManifest } from './manifest-parser';

const ROOT = new URL('https://course.test/courses/demo/');

const manifest12 = `<?xml version="1.0"?>
<manifest identifier="m" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="org">
    <organization identifier="org">
      <title>Demo course</title>
      <item identifier="i1" identifierref="r1"><title>First</title></item>
      <item identifier="i2" identifierref="r2"><title>Second</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="r1" type="webcontent" adlcp:scormtype="sco" href="one/index.html"/>
    <resource identifier="r2" type="webcontent" adlcp:scormtype="asset" href="two.html"/>
  </resources>
</manifest>`;

describe('parseManifest', () => {
  it('identifies a SCORM 1.2 course with its title and activities', () => {
    const course = parseManifest(manifest12, ROOT);

    expect(course.edition).toBe('1.2');
    expect(course.title).toBe('Demo course');
    expect(course.activities).toEqual([
      {
        id: 'i1',
        title: 'First',
        resource: { kind: 'sco', url: 'https://course.test/courses/demo/one/index.html' },
      },
      {
        id: 'i2',
        title: 'Second',
        resource: { kind: 'asset', url: 'https://course.test/courses/demo/two.html' },
      },
    ]);
  });

  it('rejects malformed XML', () => {
    expect(() => parseManifest('<manifest><organizations>', ROOT)).toThrowError(
      /not a valid course manifest/,
    );
  });

  it('rejects a document type declaration', () => {
    const withDoctype = manifest12.replace(
      '<manifest',
      '<!DOCTYPE manifest [<!ENTITY x "y">]><manifest',
    );
    expect(() => parseManifest(withDoctype, ROOT)).toThrowError(/Document type declarations/);
  });

  it.each([
    ['CAM 1.3', '2004-2nd'],
    ['2004 3rd Edition', '2004-3rd'],
    ['2004 4th Edition', '2004-4th'],
  ])('identifies %s and its SCOs', (schemaVersion, edition) => {
    const xml = manifest12
      .replace('<schemaversion>1.2<', `<schemaversion>${schemaVersion}<`)
      .replace('adlcp:scormtype="sco"', 'adlcp:scormType="sco"');
    const course = parseManifest(xml, ROOT);
    expect(course.edition).toBe(edition);
    expect(course.activities[0].resource.kind).toBe('sco');
  });

  it('refuses a course whose version cannot be identified', () => {
    const xml = manifest12.replace('<schemaversion>1.2<', '<schemaversion>9.9<');
    expect(() => parseManifest(xml, ROOT)).toThrowError(/could not be identified/);
  });
});

describe('parseManifest for a SCORM 2004 organization', () => {
  const manifest2004 = `<?xml version="1.0"?>
<manifest identifier="m" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3" xmlns:imsss="http://www.imsglobal.org/xsd/imsss">
  <metadata><schema>ADL SCORM</schema><schemaversion>2004 4th Edition</schemaversion></metadata>
  <organizations default="org">
    <organization identifier="org">
      <title>Course</title>
      <item identifier="module"><title>Module</title>
        <item identifier="a" identifierref="r"><title>A</title></item>
        <imsss:sequencing><imsss:controlMode choice="false" flow="true"/></imsss:sequencing>
      </item>
      <item identifier="b" identifierref="r"><title>B</title></item>
    </organization>
  </organizations>
  <resources><resource identifier="r" type="webcontent" adlcp:scormType="sco" href="a.html"/></resources>
</manifest>`;

  it('keeps modules as tree nodes and lists the launchable items in course order', () => {
    const course = parseManifest(manifest2004, ROOT);

    expect(course.activities.map((activity) => activity.id)).toEqual(['a', 'b']);
    expect(course.tree.children.map((node) => [node.id, node.children.length])).toEqual([
      ['module', 1],
      ['b', 0],
    ]);
  });

  it('reads control modes and applies the SCORM 2004 defaults to the rest', () => {
    const course = parseManifest(manifest2004, ROOT);

    expect(course.tree.children[0].sequencing.controlMode).toEqual({
      choice: false,
      choiceExit: true,
      flow: true,
      forwardOnly: false,
    });
    expect(course.tree.sequencing.controlMode).toEqual({
      choice: true,
      choiceExit: true,
      flow: false,
      forwardOnly: false,
    });
  });
});
