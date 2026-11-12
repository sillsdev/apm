import { useMemo } from 'react';
import { useGlobal } from '../context/useGlobal';
import { RecordIdentity, RecordTransformBuilder } from '@orbit/records';
import { SectionResource } from '../model';
import { AddRecord, recordRef, ReplaceRelatedRecord } from '../model/baseModel';
import { getTool, related, ToolSlug } from '.';
import { findRecords } from './tryFindRecord';

export const useSecResCreate = (
  section: RecordIdentity,
  orgWorkflowStepId?: string
) => {
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const [organization] = useGlobal('organization');
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here

  const InternalizationStep = () => {
    const workflowsteps = findRecords(memory, 'orgworkflowstep');
    const internalizationStep = workflowsteps
      .filter((s) => related(s, 'organization') === organization)
      .find(
        (s) =>
          getTool(s.attributes?.tool) === ToolSlug.Resource &&
          Boolean(s?.keys?.remoteId) === !offlineOnly
      );
    return internalizationStep;
  };

  const internalization = useMemo(() => {
    return InternalizationStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, offlineOnly]);

  const AddSectionResource = async (
    seq: number,
    desc: string | null,
    mediafile: RecordIdentity,
    passId?: string | null,
    secId?: string
  ) => {
    const secRes = {
      type: 'sectionresource',
      attributes: {
        sequenceNum: seq,
        description: desc,
      },
    } as SectionResource;
    const t = new RecordTransformBuilder();
    // AddRecord assigns secRes.id, so build the identity after it.
    const ops = [...AddRecord(t, secRes, user, memory)];
    const sectionresourceIdentity = recordRef('sectionresource', secRes.id);
    ops.push(
      ...ReplaceRelatedRecord(
        t,
        sectionresourceIdentity,
        'section',
        'section',
        secId || section.id
      ),
      ...ReplaceRelatedRecord(
        t,
        sectionresourceIdentity,
        'mediafile',
        'mediafile',
        mediafile.id
      ),
      ...ReplaceRelatedRecord(
        t,
        sectionresourceIdentity,
        'orgWorkflowStep',
        'orgworkflowstep',
        orgWorkflowStepId ?? internalization?.id
      )
    );
    if (passId) {
      ops.push(
        ...ReplaceRelatedRecord(
          t,
          sectionresourceIdentity,
          'passage',
          'passage',
          passId
        )
      );
    }
    await memory.update(ops);
  };
  return { AddSectionResource, InternalizationStep };
};
