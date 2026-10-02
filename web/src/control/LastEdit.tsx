import { useSelector } from 'react-redux';
import { ISharedStrings, IState } from '../model';
import { dateOrTime } from '../utils';
import { Button } from './Button';

interface IStateProps {
  t: ISharedStrings;
}

interface IProps extends IStateProps {
  when: string | undefined;
  cb?: () => void;
}

export const LastEdit = (props: IProps) => {
  const { when, cb, t } = props;
  const lang = useSelector((state: IState) => state.strings.lang);

  const handleHistory = () => {
    cb && cb();
  };

  return when ? (
    <Button
      id="editHist"
      key="last-edit"
      aria-label={t.lastEdit}
      sx={{ justifyContent: 'flex-start' }}
      variant="text"
      onClick={handleHistory}
    >
      {t.lastEdit.replace('{0}', dateOrTime(when, lang))}
    </Button>
  ) : (
    <></>
  );
};
