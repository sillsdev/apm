import { ITag, IVProjectStrings } from '../../../model';

const initState = {
  name: '',
  description: '',
  type: 'scripture',
  book: '',
  story: true,
  bcp47: 'und',
  languageName: '',
  isPublic: false,
  spellCheck: false,
  font: '',
  rtl: false,
  fontSize: 'large',
  tags: {} as ITag,
  flat: false,
  organizedBy: '',
  isPersonal: false,
  vProjectStrings: {} as IVProjectStrings,
  sheetUser: undefined as string | undefined,
  sheetGroup: undefined as string | undefined,
  publishUser: undefined as string | undefined,
  publishGroup: undefined as string | undefined,
};

export const initProjectState = { ...initState };
export type IProjectDialog = typeof initState;

export interface IProjectDialogState {
  state: IProjectDialog;
  setState: React.Dispatch<React.SetStateAction<IProjectDialog>>;
  setBookErr?: React.Dispatch<React.SetStateAction<string>>;
  addMode?: boolean;
  tagCheck?: boolean;
  team?: string;
}
