import { render } from '@testing-library/react';
import { AudioResourceCard } from './AudioResourceCard';
import { IRow } from '../../../../context/PassageDetailContext';
import MiniAudioPlayer from '../../../MiniAudioPlayer';

jest.mock('../../../MiniAudioPlayer', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock('../../../../utils/useMobile', () => ({
  useMobile: () => ({ isMobileWidth: false }),
}));
jest.mock('../../../../control/WrapTitle', () => ({
  WrapTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const PlayerMock = MiniAudioPlayer as unknown as jest.Mock;

const row = (id: string, segments?: string) =>
  ({
    id,
    artifactName: id,
    done: false,
    resource: null,
    mediafile: { id, attributes: { segments } },
  }) as unknown as IRow;
const clipOf = (start: number, end: number) =>
  JSON.stringify([
    { name: 'ProjRes', regionInfo: JSON.stringify([{ start, end }]) },
  ]);

const renderCard = (r: IRow) =>
  render(<AudioResourceCard row={r} setExpandedId={jest.fn()} />);

describe('AudioResourceCard', () => {
  beforeEach(() => PlayerMock.mockClear());

  it("plays its own row's clip, not one shared by the list", () => {
    renderCard(row('clip', clipOf(4, 9)));
    renderCard(row('whole'));

    const [clipProps, wholeProps] = PlayerMock.mock.calls.map((c) => c[0]);
    expect(clipProps).toMatchObject({
      srcMediaId: 'clip',
      clip: { start: 4, end: 9 },
    });
    expect(wholeProps.srcMediaId).toBe('whole');
    expect(wholeProps.clip).toBeUndefined();
  });
});
