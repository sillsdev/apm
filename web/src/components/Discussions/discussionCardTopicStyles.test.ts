import {
  discussionCardTopicItemProps,
  discussionCardTopicProps,
} from './discussionCardTopicStyles';

describe('discussionCardTopicStyles (TT-6738)', () => {
  it('allows the subject to wrap instead of clipping on one line', () => {
    expect(discussionCardTopicProps).toMatchObject({
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
      minWidth: 0,
      flex: 1,
    });
    expect(discussionCardTopicItemProps).toMatchObject({
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'row',
    });
    expect(discussionCardTopicItemProps).not.toHaveProperty(
      'overflow',
      'hidden'
    );
  });
});
