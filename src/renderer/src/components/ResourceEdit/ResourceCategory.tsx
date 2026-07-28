import type { RefObject } from 'react';
import { IResourceState } from '.';
import SelectArtifactCategory from '../Sheet/SelectArtifactCategory';
import { ArtifactCategoryType } from '../../crud';

interface IProps extends IResourceState {
  // Forwarded so the wizard can create a new category at save (not on blur).
  commitRef?: RefObject<(() => Promise<string>) | null> | undefined;
}

export const ResourceCategory = (props: IProps) => {
  const { state, setState, commitRef } = props;
  const { category, note } = state;

  const handleChange = (category: string) => {
    setState && setState((state) => ({ ...state, category, changed: true }));
  };

  // A brand-new typed category isn't committed to an id until save, so it never
  // fires onCategoryChange; mark the form dirty here so Save can enable when a
  // new category is the only edit.
  const handleNewDraft = () => {
    setState &&
      setState((state) => (state.changed ? state : { ...state, changed: true }));
  };

  return (
    <SelectArtifactCategory
      disabled={!setState}
      type={!note ? ArtifactCategoryType.Resource : ArtifactCategoryType.Note}
      initCategory={category}
      onCategoryChange={setState ? handleChange : undefined}
      onNewDraft={setState ? handleNewDraft : undefined}
      required={false}
      allowNew
      commitRef={commitRef}
    />
  );
};
