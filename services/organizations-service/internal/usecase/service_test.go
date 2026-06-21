package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
)

type fakeRepo struct {
	organizations  map[int64]*domain.Organization
	apiKeys        map[int64]domain.OrganizationAPIKey
	members        map[[2]int64]domain.Member
	projectMembers map[string]map[int64]domain.ProjectMember
	invitations    map[int64]domain.Invitation
	tokenIndex     map[string]int64
	nextOrgID      int64
	nextAPIKeyID   int64
	nextInviteID   int64
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		organizations:  make(map[int64]*domain.Organization),
		apiKeys:        make(map[int64]domain.OrganizationAPIKey),
		members:        make(map[[2]int64]domain.Member),
		projectMembers: make(map[string]map[int64]domain.ProjectMember),
		invitations:    make(map[int64]domain.Invitation),
		tokenIndex:     make(map[string]int64),
		nextOrgID:      1,
		nextAPIKeyID:   1,
		nextInviteID:   1,
	}
}

func newTestService(repo *fakeRepo) *Service {
	svc := NewService(repo)
	svc.EnablePermissionMemberships(repo)
	return svc
}

func (f *fakeRepo) Create(_ context.Context, organization *domain.Organization) error {
	organization.ID = f.nextOrgID
	f.nextOrgID++
	if organization.PublicID == "" {
		organization.PublicID = "org_test"
	}
	clone := *organization
	f.organizations[organization.ID] = &clone
	return nil
}

func (f *fakeRepo) List(_ context.Context) ([]domain.Organization, error) {
	organizations := make([]domain.Organization, 0, len(f.organizations))
	for _, org := range f.organizations {
		organizations = append(organizations, *org)
	}
	return organizations, nil
}

func (f *fakeRepo) GetByID(_ context.Context, id int64) (*domain.Organization, error) {
	org, ok := f.organizations[id]
	if !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	clone := *org
	return &clone, nil
}

func (f *fakeRepo) GetByPublicID(_ context.Context, publicID string) (*domain.Organization, error) {
	for _, org := range f.organizations {
		if org.PublicID != publicID {
			continue
		}
		clone := *org
		return &clone, nil
	}
	return nil, domain.ErrOrganizationNotFound
}

func (f *fakeRepo) UpdateName(_ context.Context, id int64, name string) (*domain.Organization, error) {
	org, ok := f.organizations[id]
	if !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	org.Name = name
	clone := *org
	return &clone, nil
}

func (f *fakeRepo) DeleteOrganization(_ context.Context, organizationID int64, deletedAt time.Time) error {
	org, ok := f.organizations[organizationID]
	if !ok || org.DeletedAt != nil {
		return domain.ErrOrganizationNotFound
	}
	deletedAt = deletedAt.UTC()
	org.Name = "Deleted organization"
	org.DeletedAt = &deletedAt

	for key, member := range f.members {
		if key[0] != organizationID {
			continue
		}
		member.Roles = nil
		member.DeletedAt = &deletedAt
		f.members[key] = member
	}
	for id, invitation := range f.invitations {
		if invitation.OrganizationID != organizationID {
			continue
		}
		invitation.Email = "deleted-invitation@anonymized.local"
		invitation.Token = "deleted-invitation"
		invitation.Message = ""
		invitation.Status = domain.InvitationStatusRevoked
		invitation.RespondedAt = &deletedAt
		invitation.DeletedAt = &deletedAt
		f.invitations[id] = invitation
	}
	for id, key := range f.apiKeys {
		if key.OrganizationID != organizationID {
			continue
		}
		key.Name = "Deleted API key"
		key.Prefix = "deleted"
		key.KeyHash = "deleted-api-key"
		key.Key = ""
		key.RevokedAt = &deletedAt
		f.apiKeys[id] = key
	}
	return nil
}

func (f *fakeRepo) ListOrganizationsByUser(_ context.Context, userID int64) ([]domain.Membership, error) {
	out := make([]domain.Membership, 0)
	for key, member := range f.members {
		if key[1] != userID {
			continue
		}
		out = append(out, domain.Membership{
			OrganizationID: member.OrganizationID,
			UserID:         member.UserID,
			Roles:          append([]string(nil), member.Roles...),
		})
	}
	return out, nil
}

func (f *fakeRepo) CreateAPIKey(_ context.Context, key *domain.OrganizationAPIKey) error {
	if _, ok := f.organizations[key.OrganizationID]; !ok {
		return domain.ErrOrganizationNotFound
	}
	key.ID = f.nextAPIKeyID
	f.nextAPIKeyID++
	clone := *key
	clone.Key = ""
	f.apiKeys[key.ID] = clone
	return nil
}

func (f *fakeRepo) ListAPIKeys(_ context.Context, organizationID int64) ([]domain.OrganizationAPIKey, error) {
	if _, ok := f.organizations[organizationID]; !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	out := make([]domain.OrganizationAPIKey, 0)
	for _, key := range f.apiKeys {
		if key.OrganizationID == organizationID && key.RevokedAt == nil {
			out = append(out, key)
		}
	}
	return out, nil
}

func (f *fakeRepo) GetAPIKeyByHash(_ context.Context, keyHash string) (*domain.OrganizationAPIKey, error) {
	for _, key := range f.apiKeys {
		if key.KeyHash == keyHash && key.RevokedAt == nil {
			clone := key
			return &clone, nil
		}
	}
	return nil, domain.ErrOrganizationNotFound
}

func (f *fakeRepo) MarkAPIKeyLastUsed(_ context.Context, keyID int64, lastUsedAt time.Time) error {
	key, ok := f.apiKeys[keyID]
	if !ok || key.RevokedAt != nil {
		return domain.ErrOrganizationNotFound
	}
	lastUsedAt = lastUsedAt.UTC()
	key.LastUsedAt = &lastUsedAt
	f.apiKeys[keyID] = key
	return nil
}

func (f *fakeRepo) RevokeAPIKey(_ context.Context, organizationID, keyID int64, revokedAt time.Time) error {
	key, ok := f.apiKeys[keyID]
	if !ok || key.OrganizationID != organizationID || key.RevokedAt != nil {
		return domain.ErrOrganizationNotFound
	}
	key.RevokedAt = &revokedAt
	f.apiKeys[keyID] = key
	return nil
}

func (f *fakeRepo) UpsertMember(_ context.Context, member *domain.Member) error {
	if _, ok := f.organizations[member.OrganizationID]; !ok {
		return domain.ErrOrganizationNotFound
	}

	key := [2]int64{member.OrganizationID, member.UserID}
	clone := *member
	clone.Roles = append([]string(nil), member.Roles...)
	f.members[key] = clone
	return nil
}

func (f *fakeRepo) ListMembers(_ context.Context, organizationID int64) ([]domain.Member, error) {
	if _, ok := f.organizations[organizationID]; !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	out := make([]domain.Member, 0)
	for key, member := range f.members {
		if key[0] == organizationID {
			clone := member
			clone.Roles = append([]string(nil), member.Roles...)
			out = append(out, clone)
		}
	}
	return out, nil
}

func (f *fakeRepo) AssignRole(_ context.Context, organizationID, userID int64, role string) (*domain.Member, error) {
	if _, ok := f.organizations[organizationID]; !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	key := [2]int64{organizationID, userID}
	member, ok := f.members[key]
	if !ok {
		return nil, domain.ErrMemberNotFound
	}
	member.Roles = domain.AddRole(member.Roles, role)
	f.members[key] = member
	clone := member
	clone.Roles = append([]string(nil), member.Roles...)
	return &clone, nil
}

func (f *fakeRepo) UpdateMemberRoles(_ context.Context, organizationID, userID int64, roles []string) (*domain.Member, error) {
	if _, ok := f.organizations[organizationID]; !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	key := [2]int64{organizationID, userID}
	member, ok := f.members[key]
	if !ok || member.DeletedAt != nil {
		return nil, domain.ErrMemberNotFound
	}
	member.Roles = append([]string(nil), roles...)
	f.members[key] = member
	clone := member
	clone.Roles = append([]string(nil), member.Roles...)
	return &clone, nil
}

func (f *fakeRepo) RemoveMember(_ context.Context, organizationID, userID int64) error {
	if _, ok := f.organizations[organizationID]; !ok {
		return domain.ErrOrganizationNotFound
	}
	key := [2]int64{organizationID, userID}
	member, ok := f.members[key]
	if !ok || member.DeletedAt != nil {
		return domain.ErrMemberNotFound
	}
	removedAt := time.Now().UTC()
	member.DeletedAt = &removedAt
	member.Roles = nil
	f.members[key] = member
	return nil
}

func (f *fakeRepo) UpsertProjectMember(_ context.Context, member *domain.ProjectMember) error {
	if _, ok := f.organizations[member.OrganizationID]; !ok {
		return domain.ErrOrganizationNotFound
	}
	if f.projectMembers[member.ProjectID] == nil {
		f.projectMembers[member.ProjectID] = make(map[int64]domain.ProjectMember)
	}
	clone := *member
	f.projectMembers[member.ProjectID][member.UserID] = clone
	return nil
}

func (f *fakeRepo) ListProjectMembers(_ context.Context, organizationID int64, projectID string) ([]domain.ProjectMember, error) {
	if _, ok := f.organizations[organizationID]; !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	out := make([]domain.ProjectMember, 0)
	for _, member := range f.projectMembers[projectID] {
		if member.OrganizationID == organizationID {
			out = append(out, member)
		}
	}
	return out, nil
}

func (f *fakeRepo) ListProjectMembersByUser(_ context.Context, organizationID, userID int64) ([]domain.ProjectMember, error) {
	if _, ok := f.organizations[organizationID]; !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	out := make([]domain.ProjectMember, 0)
	for _, membersByUser := range f.projectMembers {
		member, ok := membersByUser[userID]
		if ok && member.OrganizationID == organizationID {
			out = append(out, member)
		}
	}
	return out, nil
}

func (f *fakeRepo) RemoveProjectMember(_ context.Context, organizationID int64, projectID string, userID int64) error {
	if _, ok := f.organizations[organizationID]; !ok {
		return domain.ErrOrganizationNotFound
	}
	if f.projectMembers[projectID] != nil {
		delete(f.projectMembers[projectID], userID)
	}
	return nil
}

func (f *fakeRepo) DeleteOrganizationPermissions(_ context.Context, organizationID int64) error {
	for key := range f.members {
		if key[0] == organizationID {
			delete(f.members, key)
		}
	}
	for projectID, members := range f.projectMembers {
		for userID, member := range members {
			if member.OrganizationID == organizationID {
				delete(members, userID)
			}
		}
		if len(members) == 0 {
			delete(f.projectMembers, projectID)
		}
	}
	return nil
}

func (f *fakeRepo) CreateInvitation(_ context.Context, invitation *domain.Invitation) error {
	if _, ok := f.organizations[invitation.OrganizationID]; !ok {
		return domain.ErrOrganizationNotFound
	}
	invitation.ID = f.nextInviteID
	f.nextInviteID++
	clone := cloneInvitation(*invitation)
	f.invitations[clone.ID] = clone
	f.tokenIndex[clone.Token] = clone.ID
	return nil
}

func (f *fakeRepo) ListInvitations(_ context.Context, organizationID int64) ([]domain.Invitation, error) {
	if _, ok := f.organizations[organizationID]; !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	out := make([]domain.Invitation, 0)
	for _, invitation := range f.invitations {
		if invitation.OrganizationID != organizationID || invitation.DeletedAt != nil {
			continue
		}
		out = append(out, cloneInvitation(invitation))
	}
	return out, nil
}

func (f *fakeRepo) GetInvitationByID(_ context.Context, organizationID, invitationID int64) (*domain.Invitation, error) {
	invitation, ok := f.invitations[invitationID]
	if !ok || invitation.OrganizationID != organizationID || invitation.DeletedAt != nil {
		return nil, domain.ErrInvitationNotFound
	}
	clone := cloneInvitation(invitation)
	return &clone, nil
}

func (f *fakeRepo) GetInvitationByToken(_ context.Context, token string) (*domain.Invitation, error) {
	id, ok := f.tokenIndex[token]
	if !ok {
		return nil, domain.ErrInvitationNotFound
	}
	invitation, ok := f.invitations[id]
	if !ok || invitation.DeletedAt != nil {
		return nil, domain.ErrInvitationNotFound
	}
	clone := cloneInvitation(invitation)
	return &clone, nil
}

func (f *fakeRepo) UpdateInvitation(_ context.Context, invitation *domain.Invitation) (*domain.Invitation, error) {
	current, ok := f.invitations[invitation.ID]
	if !ok || current.OrganizationID != invitation.OrganizationID || current.DeletedAt != nil {
		return nil, domain.ErrInvitationNotFound
	}
	if current.Status != domain.InvitationStatusPending {
		return nil, domain.ErrInvitationAlreadyHandled
	}
	current.Email = invitation.Email
	current.Locale = invitation.Locale
	current.Role = invitation.Role
	current.Message = invitation.Message
	current.ExpiresAt = cloneTimePtr(invitation.ExpiresAt)
	f.invitations[invitation.ID] = current
	clone := cloneInvitation(current)
	return &clone, nil
}

func (f *fakeRepo) DeleteInvitation(_ context.Context, organizationID, invitationID int64) error {
	current, ok := f.invitations[invitationID]
	if !ok || current.OrganizationID != organizationID || current.DeletedAt != nil {
		return domain.ErrInvitationNotFound
	}
	now := time.Now().UTC()
	current.Status = domain.InvitationStatusRevoked
	current.DeletedAt = &now
	current.RespondedAt = &now
	f.invitations[invitationID] = current
	return nil
}

func (f *fakeRepo) AcceptInvitationByToken(_ context.Context, token string, userID int64, acceptedAt time.Time) (*domain.Invitation, *domain.Member, error) {
	id, ok := f.tokenIndex[token]
	if !ok {
		return nil, nil, domain.ErrInvitationNotFound
	}
	invitation, ok := f.invitations[id]
	if !ok || invitation.DeletedAt != nil {
		return nil, nil, domain.ErrInvitationNotFound
	}
	if invitation.Status != domain.InvitationStatusPending {
		return nil, nil, domain.ErrInvitationAlreadyHandled
	}
	if invitation.ExpiresAt != nil && !invitation.ExpiresAt.After(acceptedAt) {
		return nil, nil, domain.ErrInvitationExpired
	}
	if _, ok := f.organizations[invitation.OrganizationID]; !ok {
		return nil, nil, domain.ErrOrganizationNotFound
	}

	actedAt := acceptedAt.UTC()
	invitation.Status = domain.InvitationStatusAccepted
	invitation.AcceptedByUserID = userID
	invitation.RespondedAt = &actedAt
	f.invitations[id] = invitation

	member := domain.Member{
		OrganizationID: invitation.OrganizationID,
		UserID:         userID,
		Roles:          []string{invitation.Role},
		AddedAt:        actedAt,
	}
	if invitation.ProjectID != "" {
		member.Roles = []string{"viewer"}
	}
	key := [2]int64{member.OrganizationID, member.UserID}
	f.members[key] = member

	invitationClone := cloneInvitation(invitation)
	memberClone := member
	memberClone.Roles = append([]string(nil), member.Roles...)
	return &invitationClone, &memberClone, nil
}

func (f *fakeRepo) RefuseInvitationByToken(_ context.Context, token string, userID int64, refusedAt time.Time) (*domain.Invitation, error) {
	id, ok := f.tokenIndex[token]
	if !ok {
		return nil, domain.ErrInvitationNotFound
	}
	invitation, ok := f.invitations[id]
	if !ok || invitation.DeletedAt != nil {
		return nil, domain.ErrInvitationNotFound
	}
	if invitation.Status != domain.InvitationStatusPending {
		return nil, domain.ErrInvitationAlreadyHandled
	}
	if invitation.ExpiresAt != nil && !invitation.ExpiresAt.After(refusedAt) {
		return nil, domain.ErrInvitationExpired
	}
	actedAt := refusedAt.UTC()
	invitation.Status = domain.InvitationStatusRefused
	invitation.AcceptedByUserID = userID
	invitation.RespondedAt = &actedAt
	f.invitations[id] = invitation
	clone := cloneInvitation(invitation)
	return &clone, nil
}

func cloneInvitation(value domain.Invitation) domain.Invitation {
	value.ExpiresAt = cloneTimePtr(value.ExpiresAt)
	value.RespondedAt = cloneTimePtr(value.RespondedAt)
	value.DeletedAt = cloneTimePtr(value.DeletedAt)
	return value
}

func cloneTimePtr(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	clone := *value
	return &clone
}

func TestCreateOrganization(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		repo := newFakeRepo()
		svc := newTestService(repo)
		organization, err := svc.CreateOrganization(context.Background(), "Acme", 1)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if organization.ID != 1 {
			t.Fatalf("expected id 1, got %d", organization.ID)
		}
	})

	t.Run("validation error", func(t *testing.T) {
		repo := newFakeRepo()
		svc := newTestService(repo)
		_, err := svc.CreateOrganization(context.Background(), "", 0)
		if !errors.Is(err, domain.ErrInvalidOrganization) {
			t.Fatalf("expected ErrInvalidOrganization, got %v", err)
		}
	})
}

func TestUpdateOrganizationName(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)
	organization, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}

	updated, err := svc.UpdateOrganizationName(context.Background(), organization.ID, "  Acme Europe  ")
	if err != nil {
		t.Fatalf("update org name: %v", err)
	}
	if updated.Name != "Acme Europe" {
		t.Fatalf("expected trimmed name, got %q", updated.Name)
	}

	stored, err := svc.GetOrganization(context.Background(), organization.ID)
	if err != nil {
		t.Fatalf("get org: %v", err)
	}
	if stored.Name != "Acme Europe" {
		t.Fatalf("expected persisted name, got %q", stored.Name)
	}
}

func TestDeleteOrganizationSoftDeletesAndAnonymizesSensitiveData(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)
	deletedAt := time.Date(2026, 2, 3, 4, 5, 6, 0, time.UTC)
	svc.now = func() time.Time { return deletedAt }

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}
	if _, err := svc.AddMember(context.Background(), org.ID, 42); err != nil {
		t.Fatalf("add member: %v", err)
	}
	if _, err := svc.AssignRole(context.Background(), org.ID, 42, "editor"); err != nil {
		t.Fatalf("assign role: %v", err)
	}
	if _, err := svc.CreateOrganizationAPIKey(context.Background(), org.ID, "Production key"); err != nil {
		t.Fatalf("create api key: %v", err)
	}
	if _, err := svc.CreateInvitation(
		context.Background(),
		org.ID,
		1,
		"person@example.com",
		"fr",
		"viewer",
		"Private onboarding note",
		nil,
	); err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	if err := svc.DeleteOrganization(context.Background(), org.ID); err != nil {
		t.Fatalf("delete org: %v", err)
	}

	stored := repo.organizations[org.ID]
	if stored.DeletedAt == nil || !stored.DeletedAt.Equal(deletedAt) {
		t.Fatalf("expected organization deleted_at %s, got %v", deletedAt, stored.DeletedAt)
	}
	if stored.Name == "Acme" {
		t.Fatalf("expected organization name to be anonymized")
	}
	if _, ok := repo.members[[2]int64{org.ID, 42}]; ok {
		t.Fatalf("expected member access to be removed from permission store")
	}
	for _, invitation := range repo.invitations {
		if invitation.Email == "person@example.com" || invitation.Message != "" || invitation.DeletedAt == nil {
			t.Fatalf("expected invitation to be anonymized and revoked: %+v", invitation)
		}
	}
	for _, key := range repo.apiKeys {
		if key.Name == "Production key" || key.KeyHash == "" || key.RevokedAt == nil {
			t.Fatalf("expected api key to be anonymized and revoked: %+v", key)
		}
	}
}

func TestCreateOrganizationAPIKeyReturnsSecretOnceAndListHidesIt(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)
	organization, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}

	created, err := svc.CreateOrganizationAPIKey(context.Background(), organization.ID, "Production")
	if err != nil {
		t.Fatalf("create api key: %v", err)
	}
	if created.Key == "" {
		t.Fatalf("expected generated key to be returned once")
	}
	if created.Prefix == "" || created.KeyHash == "" {
		t.Fatalf("expected key metadata to be stored")
	}

	keys, err := svc.ListOrganizationAPIKeys(context.Background(), organization.ID)
	if err != nil {
		t.Fatalf("list api keys: %v", err)
	}
	if len(keys) != 1 {
		t.Fatalf("expected 1 api key, got %d", len(keys))
	}
	if keys[0].Key != "" {
		t.Fatalf("listed api keys must not expose secret material")
	}
	if keys[0].Name != "Production" {
		t.Fatalf("expected name Production, got %q", keys[0].Name)
	}
}

func TestValidateOrganizationAPIKeyReturnsScopedMetadataAndMarksLastUsed(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)
	now := time.Date(2026, 5, 28, 12, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return now }

	organization, err := svc.CreateOrganization(context.Background(), "Acme", 42)
	if err != nil {
		t.Fatalf("create organization: %v", err)
	}
	created, err := svc.CreateOrganizationAPIKey(context.Background(), organization.ID, "Production")
	if err != nil {
		t.Fatalf("create api key: %v", err)
	}

	validated, err := svc.ValidateOrganizationAPIKey(context.Background(), created.Key)
	if err != nil {
		t.Fatalf("validate api key: %v", err)
	}

	if validated.OrganizationID != organization.ID {
		t.Fatalf("expected organization %d, got %d", organization.ID, validated.OrganizationID)
	}
	if validated.ID != created.ID {
		t.Fatalf("expected api key id %d, got %d", created.ID, validated.ID)
	}
	if validated.Key != "" || validated.KeyHash != "" {
		t.Fatalf("validated api key must not expose secret material: %+v", validated)
	}
	if validated.LastUsedAt == nil || !validated.LastUsedAt.Equal(now) {
		t.Fatalf("expected last used at to be marked, got %+v", validated.LastUsedAt)
	}
}

func TestMembersRolesFlow(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}

	member, err := svc.AddMember(context.Background(), org.ID, 42)
	if err != nil {
		t.Fatalf("add member: %v", err)
	}
	if member.UserID != 42 {
		t.Fatalf("unexpected member user id: %d", member.UserID)
	}

	updated, err := svc.AssignRole(context.Background(), org.ID, 42, "editor")
	if err != nil {
		t.Fatalf("assign role: %v", err)
	}
	if len(updated.Roles) < 2 {
		t.Fatalf("expected at least 2 roles, got %v", updated.Roles)
	}

	members, err := svc.ListMembers(context.Background(), org.ID)
	if err != nil {
		t.Fatalf("list members: %v", err)
	}
	if len(members) != 2 {
		t.Fatalf("expected creator + member, got %d", len(members))
	}
}

func TestMemberActionsFlow(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)
	svc.now = func() time.Time {
		return time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	}

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}
	member, err := svc.AddMember(context.Background(), org.ID, 42)
	if err != nil {
		t.Fatalf("add member: %v", err)
	}

	updated, err := svc.UpdateMemberRoles(context.Background(), org.ID, member.UserID, []string{" Editor ", "viewer", "editor"})
	if err != nil {
		t.Fatalf("update member roles: %v", err)
	}
	if got, want := updated.Roles, []string{"editor", "viewer"}; !equalStrings(got, want) {
		t.Fatalf("roles mismatch: got %v want %v", got, want)
	}

	if err := svc.RemoveMember(context.Background(), org.ID, member.UserID); err != nil {
		t.Fatalf("remove member: %v", err)
	}
}

func TestUpdateMemberRolesRejectsEmptyRoleSet(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}
	if _, err := svc.AddMember(context.Background(), org.ID, 42); err != nil {
		t.Fatalf("add member: %v", err)
	}

	_, err = svc.UpdateMemberRoles(context.Background(), org.ID, 42, []string{" ", ""})
	if !errors.Is(err, domain.ErrInvalidRole) {
		t.Fatalf("expected ErrInvalidRole, got %v", err)
	}
}

func TestUpdateMemberRolesRejectsOwnerRole(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}
	if _, err := svc.AddMember(context.Background(), org.ID, 42); err != nil {
		t.Fatalf("add member: %v", err)
	}

	_, err = svc.UpdateMemberRoles(context.Background(), org.ID, 42, []string{"owner"})
	if !errors.Is(err, domain.ErrInvalidRole) {
		t.Fatalf("expected ErrInvalidRole, got %v", err)
	}
}

func equalStrings(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}
