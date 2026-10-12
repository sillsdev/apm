import { findResourceArtifactTypeId } from './useResourceArtifactTypes';
import { ArtifactType } from '../../../model';

const at = (id: string, typename: string, remoteId?: string): ArtifactType =>
  ({
    id,
    type: 'artifacttype',
    attributes: { typename },
    ...(remoteId ? { keys: { remoteId } } : {}),
  }) as unknown as ArtifactType;

// Online + offline copies of each type coexist; remoteId present === the remote
// (online) record. This pairing is the invariant both resource flows depend on.
const types = [
  at('resource-remote', 'resource', 'r1'),
  at('resource-local', 'resource'),
  at('proj-remote', 'projectresource', 'p1'),
  at('proj-local', 'projectresource'),
];

describe('findResourceArtifactTypeId (shared resolution)', () => {
  it('picks the remote record when not offlineOnly', () => {
    expect(findResourceArtifactTypeId(types, 'resource', false)).toBe(
      'resource-remote'
    );
    expect(findResourceArtifactTypeId(types, 'projectresource', false)).toBe(
      'proj-remote'
    );
  });

  it('picks the local record when offlineOnly', () => {
    expect(findResourceArtifactTypeId(types, 'resource', true)).toBe(
      'resource-local'
    );
    expect(findResourceArtifactTypeId(types, 'projectresource', true)).toBe(
      'proj-local'
    );
  });

  it('returns undefined when no matching type exists', () => {
    expect(findResourceArtifactTypeId([], 'resource', false)).toBeUndefined();
  });
});
