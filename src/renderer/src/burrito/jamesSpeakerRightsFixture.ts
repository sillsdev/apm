import type { IntellectualPropertyD } from '../model';
import type { MediaFileD } from '../model';
import type { ProjectD } from '../model';

export const JAMES_SPEAKER_TEAM_ID = 'team-speakers';

export const JAMES_SPEAKER_HOLDERS = [
  'Greg',
  'Fred',
  'Alex',
  'Sam',
  'Jane',
] as const;

export type JamesSpeakerHolder = (typeof JAMES_SPEAKER_HOLDERS)[number];

const SPEAKER_MEDIA: Array<{
  holder: JamesSpeakerHolder;
  id: string;
  filename: string;
  contentType: string;
}> = [
  {
    holder: 'Greg',
    id: 'media-greg',
    filename: 'greg-rights.mp3',
    contentType: 'audio/mpeg',
  },
  {
    holder: 'Fred',
    id: 'media-fred',
    filename: 'fred-release.pdf',
    contentType: 'application/pdf',
  },
  {
    holder: 'Alex',
    id: 'media-alex',
    filename: 'alex-consent.png',
    contentType: 'image/png',
  },
  {
    holder: 'Sam',
    id: 'media-sam',
    filename: 'sam-statement.mp3',
    contentType: 'audio/mpeg',
  },
  {
    holder: 'Jane',
    id: 'media-jane',
    filename: 'jane-rights.pdf',
    contentType: 'application/pdf',
  },
];

export interface JamesSpeakerRightsFixture {
  teamId: string;
  project: ProjectD;
  intellectualproperties: IntellectualPropertyD[];
  mediafiles: MediaFileD[];
}

export function buildJamesSpeakerRightsFixture(): JamesSpeakerRightsFixture {
  const teamId = JAMES_SPEAKER_TEAM_ID;
  const project = {
    id: 'proj-james',
    type: 'project',
    attributes: {
      name: 'James Project',
      language: 'eng',
      defaultParams: '{}',
    },
    relationships: { organization: { data: { id: teamId } } },
  } as ProjectD;

  const mediafiles = SPEAKER_MEDIA.map(
    ({ id, filename, contentType }) =>
      ({
        id,
        type: 'mediafile',
        attributes: {
          audioUrl: `/media/${filename}`,
          originalFile: filename,
          contentType,
          versionNumber: 1,
        },
      }) as MediaFileD
  );

  const intellectualproperties = SPEAKER_MEDIA.map(
    ({ holder, id }, index) =>
      ({
        id: `ip-${holder.toLowerCase()}`,
        type: 'intellectualproperty',
        attributes: {
          rightsHolder: holder,
          notes: JSON.stringify({ fullName: holder }),
        },
        relationships: {
          organization: { data: { id: teamId } },
          releaseMediafile: { data: { id } },
        },
        keys: { remoteId: `ip-remote-${index + 1}` },
      }) as unknown as IntellectualPropertyD
  );

  return { teamId, project, intellectualproperties, mediafiles };
}

export function speakerRightsHolders(json: string): string[] {
  const parsed = JSON.parse(json) as {
    data: Array<{ attributes: { rightsHolder?: string } }>;
  };
  return parsed.data
    .map((r) => r.attributes.rightsHolder)
    .filter((h): h is string => Boolean(h));
}

export function releaseMediaDests(ipc: {
  copyFile: { mock: { calls: unknown[][] } };
}): string[] {
  return ipc.copyFile.mock.calls.map((c) => c[1] as string);
}

export function buildSpeakerRightsMemoryStub(
  fixture: JamesSpeakerRightsFixture
): { keyMap: Record<string, unknown>; cache: { query: (fn: (q: unknown) => unknown) => unknown } } {
  const records: Record<string, unknown[]> = {
    intellectualproperty: fixture.intellectualproperties,
    mediafile: fixture.mediafiles,
    organization: [
      {
        id: fixture.teamId,
        type: 'organization',
        attributes: { name: 'Speaker Team' },
        keys: { remoteId: 'org-remote' },
      },
    ],
  };

  return {
    keyMap: {},
    cache: {
      query: (fn: (q: unknown) => unknown) => {
        const q = {
          findRecords: (type: string) => records[type] ?? [],
        };
        return fn(q);
      },
    },
  };
}
