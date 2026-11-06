import { useGlobal } from '../context/useGlobal';
import { PlanD, ProjectD, VProjectD } from '../model';
import { related, useTypeId } from '.';
import {
  recordRef,
  ReplaceRelatedRecord,
  UpdateRecord,
} from '../model/baseModel';

export const useVProjectUpdate = () => {
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const getTypeId = useTypeId();

  return async (vProject: VProjectD) => {
    const id = related(vProject, 'project');
    const {
      name,
      description,
      type,
      uilanguagebcp47,
      language,
      languageName,
      isPublic,
      spellCheck,
      defaultFont,
      defaultFontSize,
      rtl,
      flat,
      tags,
      organizedBy,
      defaultParams,
      sheetUser,
      sheetGroup,
      publishUser,
      publishGroup,
    } = vProject.attributes;
    const projectIdentity = recordRef('project', id);
    await memory.update((t) => [
      ...UpdateRecord(
        t,
        {
          type: 'project',
          id,
          attributes: {
            name,
            description,
            uilanguagebcp47,
            language,
            languageName,
            isPublic,
            spellCheck,
            defaultFont,
            defaultFontSize,
            rtl,
            defaultParams,
          },
        } as ProjectD,
        user
      ),
      // We use the plan type and not the project type
      ...ReplaceRelatedRecord(
        t,
        projectIdentity,
        'projecttype',
        'projecttype',
        getTypeId(
          type.toLowerCase() === 'scripture' ? type : 'generic',
          'project'
        )
      ),
      ...ReplaceRelatedRecord(
        t,
        projectIdentity,
        'editsheetuser',
        'user',
        sheetUser
      ),
      ...ReplaceRelatedRecord(
        t,
        projectIdentity,
        'editsheetgroup',
        'group',
        sheetGroup
      ),
      ...ReplaceRelatedRecord(
        t,
        projectIdentity,
        'publishuser',
        'user',
        publishUser
      ),
      ...ReplaceRelatedRecord(
        t,
        projectIdentity,
        'publishgroup',
        'group',
        publishGroup
      ),
      //we aren't allowing them to change group, owner or oraganization currently
    ]);

    await memory.update((t) => [
      ...UpdateRecord(
        t,
        {
          type: 'plan',
          id: vProject.id,
          attributes: {
            name,
            flat,
            tags: JSON.stringify(tags),
            organizedBy,
            sectionCount: vProject.attributes.sectionCount,
            slug: vProject.attributes.slug,
          },
        } as any as PlanD,
        user
      ),
      ...ReplaceRelatedRecord(
        t,
        recordRef('plan', vProject.id),
        'plantype',
        'plantype',
        getTypeId(type, 'plan')
      ),
    ]);
  };
};
