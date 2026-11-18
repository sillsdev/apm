import { useGlobal } from '../context/useGlobal';
import { PlanD, ProjectD, VProjectD } from '../model';
import { related, useTypeId } from '.';
import { ReplaceRelatedRecord, UpdateRecord } from '../model/baseModel';

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
    const projectRec = {
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
    } as ProjectD;
    await memory.update((t) => [
      ...UpdateRecord(t, projectRec, user),
      // We use the plan type and not the project type
      ...ReplaceRelatedRecord(
        t,
        projectRec,
        'projecttype',
        'projecttype',
        getTypeId(
          type.toLowerCase() === 'scripture' ? type : 'generic',
          'project'
        )
      ),
      ...ReplaceRelatedRecord(
        t,
        projectRec,
        'editsheetuser',
        'user',
        sheetUser
      ),
      ...ReplaceRelatedRecord(
        t,
        projectRec,
        'editsheetgroup',
        'group',
        sheetGroup
      ),
      ...ReplaceRelatedRecord(
        t,
        projectRec,
        'publishuser',
        'user',
        publishUser
      ),
      ...ReplaceRelatedRecord(
        t,
        projectRec,
        'publishgroup',
        'group',
        publishGroup
      ),
      //we aren't allowing them to change group, owner or oraganization currently
    ]);

    const planRec = {
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
    } as any as PlanD;
    await memory.update((t) => [
      ...UpdateRecord(t, planRec, user),
      ...ReplaceRelatedRecord(
        t,
        planRec,
        'plantype',
        'plantype',
        getTypeId(type, 'plan')
      ),
    ]);
  };
};
