import { schema } from '../schema';
import type { ActivityState } from './activityState';
import type { ArtifactCategory } from './artifactCategory';
import type { ArtifactType } from './artifactType';
import type { AudacityProject } from './audacityProject';
import type { Bible } from './bible';
import type { Comment } from './comment';
import type { Discussion } from './discussion';
import type { Graphic } from './graphic';
import type { Group } from './group';
import type { GroupMembership } from './groupMembership';
import type { Integration } from './integration';
import type { IntellectualProperty } from './intellectualProperty';
import type { Invitation } from './invitation';
import type { MediaFile } from './mediafile';
import type { MediaReplacement } from './mediareplacement';
import type { OfflineProject } from './offlineProject';
import type { Organization } from './organization';
import type { OrganizationBible } from './organizationBible';
import type { OrganizationMembership } from './organizationMembership';
import type { OrganizationScheme } from './organizationScheme';
import type { OrganizationSchemeStep } from './organizationSchemeStep';
import type { OrgKeyterm } from './orgKeyterm';
import type { OrgKeytermReference } from './orgKeytermReference';
import type { OrgKeytermTarget } from './orgKeytermTarget';
import type { OrgWorkflowStep } from './orgWorkflowStep';
import type { Passage } from './passage';
import type { PassageStateChange } from './passageStateChange';
import type { PassageType } from './passageType';
import type { Plan } from './plan';
import type { PlanType } from './planType';
import type { Project } from './project';
import type { ProjectIntegration } from './projectintegration';
import type { ProjectType } from './projectType';
import type { Resource } from './resource';
import type { Role } from './role';
import type { Section } from './section';
import type { SectionResource } from './sectionResource';
import type { SectionResourceUser } from './sectionResourceUser';
import type { SharedResource } from './sharedResource';
import type { SharedResourceReference } from './sharedResourceReference';
import type { CurrentUser, User } from './user';
import type { WorkflowStep } from './workflowStep';

type WithRelationships = { relationships?: object };

type RelationshipNames<T extends WithRelationships> = keyof NonNullable<
  T['relationships']
> &
  string;

// The list has to name every interface key and no others. satisfies checks the
// names that are present; the conditional rejects a list that drops one.
const relationshipKeys =
  <T extends WithRelationships>() =>
  <const K extends readonly RelationshipNames<T>[]>(
    keys: [RelationshipNames<T>] extends [K[number]] ? K : never
  ) =>
    keys satisfies readonly RelationshipNames<T>[];

const expectedRelationshipKeys = {
  activitystate: relationshipKeys<ActivityState>()(['lastModifiedByUser']),
  artifactcategory: relationshipKeys<ArtifactCategory>()([
    'titleMediafile',
    'organization',
    'lastModifiedByUser',
  ]),
  artifacttype: relationshipKeys<ArtifactType>()([
    'organization',
    'lastModifiedByUser',
  ]),
  audacityproject: relationshipKeys<AudacityProject>()([
    'passage',
    'lastModifiedByUser',
  ]),
  bible: relationshipKeys<Bible>()([
    'isoMediafile',
    'bibleMediafile',
    'lastModifiedByUser',
  ]),
  comment: relationshipKeys<Comment>()([
    'mediafile',
    'discussion',
    'lastModifiedByUser',
    'creatorUser',
  ]),
  currentuser: relationshipKeys<CurrentUser>()(['lastModifiedByUser']),
  discussion: relationshipKeys<Discussion>()([
    'mediafile',
    'group',
    'user',
    'artifactCategory',
    'lastModifiedByUser',
    'orgWorkflowStep',
    'creatorUser',
  ]),
  graphic: relationshipKeys<Graphic>()([
    'organization',
    'mediafile',
    'lastModifiedByUser',
  ]),
  group: relationshipKeys<Group>()(['owner', 'lastModifiedByUser']),
  groupmembership: relationshipKeys<GroupMembership>()([
    'user',
    'group',
    'role',
    'lastModifiedByUser',
  ]),
  integration: relationshipKeys<Integration>()(['lastModifiedByUser']),
  intellectualproperty: relationshipKeys<IntellectualProperty>()([
    'organization',
    'releaseMediafile',
    'lastModifiedByUser',
  ]),
  invitation: relationshipKeys<Invitation>()([
    'organization',
    'role',
    'allUsersRole',
    'lastModifiedByUser',
  ]),
  mediafile: relationshipKeys<MediaFile>()([
    'passage',
    'resourcePassage',
    'plan',
    'lastModifiedByUser',
    'artifactType',
    'artifactCategory',
    'orgWorkflowStep',
    'recordedbyUser',
    'sourceMedia',
    'renderSourceMedia',
  ]),
  mediareplacement: relationshipKeys<MediaReplacement>()([
    'passage',
    'replacementMediafile',
    'outputMediafile',
    'lastModifiedByUser',
  ]),
  offlineproject: relationshipKeys<OfflineProject>()([
    'project',
    'lastModifiedByUser',
  ]),
  organization: relationshipKeys<Organization>()([
    'owner',
    'cluster',
    'lastModifiedByUser',
  ]),
  organizationbible: relationshipKeys<OrganizationBible>()([
    'bible',
    'organization',
    'lastModifiedByUser',
  ]),
  organizationmembership: relationshipKeys<OrganizationMembership>()([
    'user',
    'role',
    'organization',
    'lastModifiedByUser',
  ]),
  organizationscheme: relationshipKeys<OrganizationScheme>()([
    'organization',
    'lastModifiedByUser',
  ]),
  organizationschemestep: relationshipKeys<OrganizationSchemeStep>()([
    'organizationscheme',
    'orgWorkflowStep',
    'user',
    'group',
    'lastModifiedByUser',
  ]),
  orgkeyterm: relationshipKeys<OrgKeyterm>()([
    'organization',
    'lastModifiedByUser',
  ]),
  orgkeytermreference: relationshipKeys<OrgKeytermReference>()([
    'orgkeyterm',
    'project',
    'section',
    'lastModifiedByUser',
  ]),
  orgkeytermtarget: relationshipKeys<OrgKeytermTarget>()([
    'organization',
    'mediafile',
    'lastModifiedByUser',
  ]),
  orgworkflowstep: relationshipKeys<OrgWorkflowStep>()([
    'organization',
    'lastModifiedByUser',
  ]),
  passage: relationshipKeys<Passage>()([
    'section',
    'lastModifiedByUser',
    'sharedResource',
    'passagetype',
  ]),
  passagestatechange: relationshipKeys<PassageStateChange>()([
    'passage',
    'lastModifiedByUser',
  ]),
  passagetype: relationshipKeys<PassageType>()(['lastModifiedByUser']),
  plan: relationshipKeys<Plan>()([
    'project',
    'plantype',
    'lastModifiedByUser',
    'owner',
  ]),
  plantype: relationshipKeys<PlanType>()(['lastModifiedByUser']),
  project: relationshipKeys<Project>()([
    'projecttype',
    'owner',
    'organization',
    'group',
    'plans',
    'lastModifiedByUser',
    'editsheetuser',
    'editsheetgroup',
    'publishuser',
    'publishgroup',
  ]),
  projectintegration: relationshipKeys<ProjectIntegration>()([
    'project',
    'integration',
    'lastModifiedByUser',
  ]),
  projecttype: relationshipKeys<ProjectType>()(['lastModifiedByUser']),
  resource: relationshipKeys<Resource>()(['passage', 'lastModifiedByUser']),
  role: relationshipKeys<Role>()(['lastModifiedByUser']),
  section: relationshipKeys<Section>()([
    'plan',
    'passages',
    'transcriber',
    'editor',
    'group',
    'titleMediafile',
    'lastModifiedByUser',
    'organizationScheme',
  ]),
  sectionresource: relationshipKeys<SectionResource>()([
    'project',
    'section',
    'passage',
    'mediafile',
    'orgWorkflowStep',
    'lastModifiedByUser',
  ]),
  sectionresourceuser: relationshipKeys<SectionResourceUser>()([
    'sectionresource',
    'user',
    'lastModifiedByUser',
  ]),
  sharedresource: relationshipKeys<SharedResource>()([
    'passage',
    'cluster',
    'artifactCategory',
    'titleMediafile',
    'lastModifiedByUser',
  ]),
  sharedresourcereference: relationshipKeys<SharedResourceReference>()([
    'sharedResource',
    'lastModifiedByUser',
  ]),
  user: relationshipKeys<User>()(['lastModifiedByUser']),
  workflowstep: relationshipKeys<WorkflowStep>()(['lastModifiedByUser']),
};

const sorted = (keys: readonly string[]) => [...keys].sort();

describe('schema relationships', () => {
  test.each(Object.entries(expectedRelationshipKeys))(
    '%s matches its interface',
    (type, declared) => {
      const defined = Object.keys(schema.getModel(type).relationships ?? {});
      expect(sorted(defined)).toEqual(sorted(declared));
    }
  );

  test('schema models without an interface declare no relationships', () => {
    const declared = new Set<string>(Object.keys(expectedRelationshipKeys));
    const undeclared = Object.keys(schema.models).filter(
      (type) =>
        !declared.has(type) &&
        Object.keys(schema.getModel(type).relationships ?? {}).length > 0
    );
    expect(undeclared).toEqual([]);
  });
});
