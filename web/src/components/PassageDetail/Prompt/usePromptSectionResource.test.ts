import { findPromptRow } from './usePromptSectionResource';
import { IRow } from '../../../context/PassageDetailContext';
import { SectionD, SectionResourceD } from '../../../model';

const section = {
  id: 'section-1',
  type: 'section',
} as SectionD;

const makeRow = (mediaId: string, stepId: string, passageId = ''): IRow =>
  ({
    id: mediaId,
    sequenceNum: 0,
    isResource: true,
    isText: false,
    passageId,
    resource: {
      id: `sr-${mediaId}`,
      type: 'sectionresource',
      attributes: { sequenceNum: 0 },
      relationships: {
        section: { data: { type: 'section', id: 'section-1' } },
        orgWorkflowStep: { data: { type: 'orgworkflowstep', id: stepId } },
        mediafile: { data: { type: 'mediafile', id: mediaId } },
      },
    } as SectionResourceD,
    mediafile: { id: mediaId, type: 'mediafile', attributes: {} },
  }) as IRow;

describe('findPromptRow', () => {
  it('returns section-level resource for current step', () => {
    const row = findPromptRow(
      [makeRow('media-a', 'step-prompt'), makeRow('media-b', 'step-other')],
      section,
      'step-prompt'
    );
    expect(row?.id).toBe('media-a');
  });

  it('returns undefined when no section resources exist', () => {
    expect(findPromptRow([], section, 'step-prompt')).toBeUndefined();
  });

  it('returns undefined when multiple resources exist but none match step', () => {
    expect(
      findPromptRow(
        [
          makeRow('media-a', 'step-other'),
          makeRow('media-b', 'step-internalize'),
        ],
        section,
        'step-prompt'
      )
    ).toBeUndefined();
  });

  it('uses single legacy section resource when step link is missing', () => {
    const row = findPromptRow(
      [makeRow('media-only', 'step-internalize')],
      section,
      'step-prompt'
    );
    expect(row?.id).toBe('media-only');
  });

  it('ignores passage-scoped resources', () => {
    expect(
      findPromptRow(
        [makeRow('media-p', 'step-prompt', 'passage-1')],
        section,
        'step-prompt'
      )
    ).toBeUndefined();
  });

  it('prefers lowest sequenceNum when multiple match step', () => {
    const rows = [
      { ...makeRow('media-2', 'step-prompt'), sequenceNum: 2 },
      { ...makeRow('media-1', 'step-prompt'), sequenceNum: 1 },
    ];
    expect(findPromptRow(rows, section, 'step-prompt')?.id).toBe('media-1');
  });
});
