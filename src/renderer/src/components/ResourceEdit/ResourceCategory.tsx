import type { MutableRefObject } from 'react';
import { IResourceState } from '.';
import SelectArtifactCategory from '../Sheet/SelectArtifactCategory';
import { ArtifactCategoryType } from '../../crud';

interface IProps extends IResourceState {
  // Forwarded so the wizard can create a new category at save (not on blur).
  commitRef?: MutableRefObject<(() => Promise<string>) | null> | undefined;
}

export const ResourceCategory = (props: IProps) => {
  const { state, setState, commitRef } = props;
  const { category, note } = state;

  const handleChange = (category: string) => {
    setState && setState((state) => ({ ...state, category, changed: true }));
  };

  return (
    <SelectArtifactCategory
      disabled={!setState}
      type={!note ? ArtifactCategoryType.Resource : ArtifactCategoryType.Note}
      initCategory={category}
      onCategoryChange={setState ? handleChange : undefined}
      required={false}
      allowNew
      commitRef={commitRef}
    />
  );
};
