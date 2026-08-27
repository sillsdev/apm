import { InitializedRecord } from '@orbit/records';
import { apmGraphic } from '../components/apmGraphic';
import { useOrbitData } from '../hoc/useOrbitData';
import { ArtifactCategoryD, GraphicD } from '../model';
import { useArtifactCategory } from './useArtifactCategory';
import { related } from './related';
import { useGlobal } from '../context/useGlobal';

export function useGraphicFind() {
  const graphics = useOrbitData<GraphicD[]>('graphic');
  const artifactCategory =
    useOrbitData<ArtifactCategoryD[]>('artifactcategory');
  const { fromLocalizedArtifactCategory } = useArtifactCategory();
  const [organization] = useGlobal('organization');

  return (recId: InitializedRecord, ref?: string) => {
    let graphicRec = graphics.find(
      (g) =>
        g.attributes.resourceType === recId?.type &&
        g.attributes.resourceId === parseInt(recId?.keys?.remoteId ?? '0')
    );
    let color: string | undefined = undefined;
    const isChnum = /^CHNUM\b/i.test(ref ?? '');
    const catText = isChnum ? undefined : ref?.split('|')[1];
    const catRec = isChnum
      ? (artifactCategory.find(
          (c) =>
            c.attributes?.specialuse === 'chapter' &&
            (related(c, 'organization') === organization ||
              related(c, 'organization') === null)
        ) ??
        artifactCategory.find((c) => c.attributes?.specialuse === 'chapter'))
      : catText
        ? artifactCategory.find(
            (c) =>
              c.attributes?.categoryname ===
                fromLocalizedArtifactCategory(catText) ||
              c.attributes?.categoryname === catText
          )
        : undefined;
    if (catRec) {
      color = catRec.attributes?.color;
      if (!graphicRec) {
        graphicRec = graphics.find(
          (g) =>
            g.attributes.resourceType === 'category' &&
            g.attributes.resourceId === parseInt(catRec?.keys?.remoteId ?? '0')
        );
      }
    }
    if (graphicRec) {
      const gr = apmGraphic(graphicRec);
      return {
        uri: gr?.graphicUri,
        rights: gr?.graphicRights,
        url: gr?.url,
        color,
      };
    }
    return { uri: undefined, rights: undefined, url: undefined, color };
  };
}
