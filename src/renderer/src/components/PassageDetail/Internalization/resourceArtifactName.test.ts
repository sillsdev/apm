import { UploadType } from '../../UploadType';
import {
  canSaveResourceEdit,
  descriptionRequiredForResource,
  resourceArtifactName,
} from './resourceArtifactName';

const UriLinkType = 'text/uri-list';
const MarkDownType = 'text/markdown';
const FaithbridgeType = 'audio/mpeg/s3link';

describe('descriptionRequiredForResource', () => {
  it('requires description for Link and Faithbridge upload types', () => {
    expect(descriptionRequiredForResource(undefined, UploadType.Link)).toBe(
      true
    );
    expect(
      descriptionRequiredForResource(undefined, UploadType.FaithbridgeLink)
    ).toBe(true);
  });

  it('requires description for UriLink and Faithbridge content types', () => {
    expect(descriptionRequiredForResource(UriLinkType)).toBe(true);
    expect(descriptionRequiredForResource(FaithbridgeType)).toBe(true);
  });

  it('does not require description for ordinary resources', () => {
    expect(
      descriptionRequiredForResource('audio/mpeg', UploadType.Resource)
    ).toBe(false);
  });

  it('requires description when originalFile is an http(s) URL (TT-6658)', () => {
    expect(
      descriptionRequiredForResource(
        'audio/mpeg',
        UploadType.Resource,
        'https://live.bible.is/bible/ENGESV/MAT/1'
      )
    ).toBe(true);
  });
});

describe('resourceArtifactName', () => {
  it('uses description when present', () => {
    expect(
      resourceArtifactName('My link', 'https://example.com/long', UriLinkType)
    ).toBe('My link');
  });

  it('does not fall back to URL for UriLink or Faithbridge (TT-6658)', () => {
    expect(
      resourceArtifactName('', 'https://example.com/very/long/url', UriLinkType)
    ).toBe('');
    expect(
      resourceArtifactName(
        '   ',
        'https://s3.example.com/faithbridge',
        FaithbridgeType
      )
    ).toBe('');
  });

  it('falls back to file name for non-link media', () => {
    expect(resourceArtifactName('', 'recording.mp3', 'audio/mpeg')).toBe(
      'recording'
    );
  });

  it('does not fall back to a Bible Brain URL when description is empty (TT-6658)', () => {
    expect(
      resourceArtifactName(
        '',
        'https://live.bible.is/bible/ENGESV/MAT/1',
        'audio/mpeg'
      )
    ).toBe('');
  });
});

describe('canSaveResourceEdit', () => {
  const isUrl = (v: string) => /^https?:\/\//.test(v);

  it('blocks save when UriLink description is empty', () => {
    expect(
      canSaveResourceEdit({
        contentType: UriLinkType,
        description: '',
        text: 'https://example.com',
        isUrl,
      })
    ).toBe(false);
  });

  it('allows save when UriLink has description and valid URL', () => {
    expect(
      canSaveResourceEdit({
        contentType: UriLinkType,
        description: 'Audio Scripture',
        text: 'https://example.com',
        isUrl,
      })
    ).toBe(true);
  });

  it('blocks Faithbridge save without description', () => {
    expect(
      canSaveResourceEdit({
        contentType: FaithbridgeType,
        description: '',
        isUrl,
      })
    ).toBe(false);
  });

  it('still requires markdown body text', () => {
    expect(
      canSaveResourceEdit({
        contentType: MarkDownType,
        description: 'ignored',
        text: '',
        isUrl,
      })
    ).toBe(false);
  });

  it('blocks save when Bible Brain originalFile is a URL and description is empty (TT-6658)', () => {
    expect(
      canSaveResourceEdit({
        contentType: 'audio/mpeg',
        description: '',
        originalFile: 'https://live.bible.is/bible/ENGESV/MAT/1',
        isUrl,
      })
    ).toBe(false);
  });
});
