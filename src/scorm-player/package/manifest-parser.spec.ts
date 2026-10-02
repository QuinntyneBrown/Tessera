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
    ['CAM 1.3', 'SCORM 2004 2nd Edition'],
    ['2004 3rd Edition', 'SCORM 2004 3rd Edition'],
    ['2004 4th Edition', 'SCORM 2004 4th Edition'],
  ])('identifies %s but refuses to launch it', (schemaVersion, label) => {
    const xml = manifest12.replace('<schemaversion>1.2<', `<schemaversion>${schemaVersion}<`);
    expect(() => parseManifest(xml, ROOT)).toThrowError(new RegExp(`${label}.*cannot be launched`));
  });

  it('refuses a course whose version cannot be identified', () => {
    const xml = manifest12.replace('<schemaversion>1.2<', '<schemaversion>9.9<');
    expect(() => parseManifest(xml, ROOT)).toThrowError(/could not be identified/);
  });
});
