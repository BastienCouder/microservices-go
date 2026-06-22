package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
)

type Service struct {
	repo                 domain.Repository
	membershipStore      MembershipStore
	projectLister        ProjectLister
	invitationNotifier   InvitationNotifier
	userEmailResolver    UserEmailResolver
	userProfileResolver  UserProfileResolver
	invitationAppBaseURL string
	invitationLoginURL   string
	now                  func() time.Time
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo, now: time.Now}
}

func (s *Service) EnableProjectHierarchy(projectLister ProjectLister) {
	s.projectLister = projectLister
}

func (s *Service) EnablePermissionMemberships(store MembershipStore) {
	s.membershipStore = store
}

func (s *Service) EnableInvitationNotifications(notifier InvitationNotifier, appBaseURL, loginURL string) {
	s.invitationNotifier = notifier
	s.invitationAppBaseURL = strings.TrimRight(strings.TrimSpace(appBaseURL), "/")
	s.invitationLoginURL = normalizeInvitationLoginURL(loginURL)
}

func (s *Service) EnableInvitationUserEmailValidation(resolver UserEmailResolver) {
	s.userEmailResolver = resolver
	if profileResolver, ok := resolver.(UserProfileResolver); ok {
		s.userProfileResolver = profileResolver
	}
}

func (s *Service) CreateOrganization(ctx context.Context, name string, ownerIdentityID int64) (*domain.Organization, error) {
	org := &domain.Organization{
		Name:            strings.TrimSpace(name),
		OwnerIdentityID: ownerIdentityID,
		CreatedAt:       s.now().UTC(),
	}
	if err := org.Validate(); err != nil {
		return nil, err
	}
	if err := s.ensureOwnerCanCreateOrganization(ctx, ownerIdentityID); err != nil {
		return nil, err
	}

	publicID, err := generateOrganizationPublicID()
	if err != nil {
		return nil, fmt.Errorf("generate organization public id: %w", err)
	}
	org.PublicID = publicID

	if err := s.repo.Create(ctx, org); err != nil {
		return nil, fmt.Errorf("create organization: %w", err)
	}
	if _, err := s.syncMemberRoles(ctx, org.ID, ownerIdentityID, []string{domain.RoleEditor}); err != nil {
		if deleteErr := s.repo.DeleteOrganization(ctx, org.ID, s.now().UTC()); deleteErr != nil {
			return nil, fmt.Errorf("seed organization creator membership: %w (cleanup failed: %v)", err, deleteErr)
		}
		return nil, fmt.Errorf("seed organization creator membership: %w", err)
	}

	return org, nil
}

func (s *Service) ensureOwnerCanCreateOrganization(ctx context.Context, ownerIdentityID int64) error {
	organizations, err := s.repo.List(ctx)
	if err != nil {
		return fmt.Errorf("list organizations: %w", err)
	}

	for _, organization := range organizations {
		if organization.DeletedAt != nil {
			continue
		}
		if organization.OwnerIdentityID == ownerIdentityID {
			return domain.ErrOwnerAlreadyHasOrganization
		}
	}

	return nil
}

func (s *Service) GetOrganization(ctx context.Context, id int64) (*domain.Organization, error) {
	org, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get organization %d: %w", id, err)
	}
	return org, nil
}

func (s *Service) ListOrganizations(ctx context.Context) ([]domain.Organization, error) {
	organizations, err := s.repo.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("list organizations: %w", err)
	}
	return organizations, nil
}

func (s *Service) GetOrganizationByPublicID(ctx context.Context, publicID string) (*domain.Organization, error) {
	normalizedPublicID := strings.TrimSpace(publicID)
	if normalizedPublicID == "" {
		return nil, fmt.Errorf("%w: organization public id is required", domain.ErrInvalidOrganization)
	}
	org, err := s.repo.GetByPublicID(ctx, normalizedPublicID)
	if err != nil {
		return nil, fmt.Errorf("get organization %s: %w", normalizedPublicID, err)
	}
	return org, nil
}

func (s *Service) UpdateOrganizationName(ctx context.Context, id int64, name string) (*domain.Organization, error) {
	name = strings.TrimSpace(name)
	if id <= 0 {
		return nil, fmt.Errorf("%w: organization id must be positive", domain.ErrInvalidOrganization)
	}
	if name == "" {
		return nil, fmt.Errorf("%w: name is required", domain.ErrInvalidOrganization)
	}

	org, err := s.repo.UpdateName(ctx, id, name)
	if err != nil {
		return nil, fmt.Errorf("update organization %d: %w", id, err)
	}
	return org, nil
}

func (s *Service) DeleteOrganization(ctx context.Context, id int64) error {
	if id <= 0 {
		return fmt.Errorf("%w: organization id must be positive", domain.ErrInvalidOrganization)
	}
	if err := s.repo.DeleteOrganization(ctx, id, s.now().UTC()); err != nil {
		return fmt.Errorf("delete organization %d: %w", id, err)
	}
	store, err := s.membershipStoreOrError()
	if err != nil {
		return err
	}
	if err := store.DeleteOrganizationPermissions(ctx, id); err != nil {
		return fmt.Errorf("delete organization permissions %d: %w", id, err)
	}
	return nil
}

func (s *Service) CreateOrganizationAPIKey(ctx context.Context, organizationID int64, name string) (*domain.OrganizationAPIKey, error) {
	name = strings.TrimSpace(name)
	rawKey, err := generateOrganizationAPIKey()
	if err != nil {
		return nil, err
	}
	keyHash := hashOrganizationAPIKey(rawKey)
	key := &domain.OrganizationAPIKey{
		OrganizationID: organizationID,
		Name:           name,
		Prefix:         apiKeyPrefix(rawKey),
		KeyHash:        keyHash,
		Key:            rawKey,
		CreatedAt:      s.now().UTC(),
	}
	if err := key.ValidateForCreate(); err != nil {
		return nil, err
	}
	if err := s.repo.CreateAPIKey(ctx, key); err != nil {
		return nil, fmt.Errorf("create organization api key: %w", err)
	}
	return key, nil
}

func (s *Service) ListOrganizationAPIKeys(ctx context.Context, organizationID int64) ([]domain.OrganizationAPIKey, error) {
	if organizationID <= 0 {
		return nil, fmt.Errorf("%w: organization id must be positive", domain.ErrInvalidOrganization)
	}
	keys, err := s.repo.ListAPIKeys(ctx, organizationID)
	if err != nil {
		return nil, fmt.Errorf("list organization api keys: %w", err)
	}
	for index := range keys {
		keys[index].Key = ""
		keys[index].KeyHash = ""
	}
	return keys, nil
}

func (s *Service) ValidateOrganizationAPIKey(ctx context.Context, rawKey string) (*domain.OrganizationAPIKey, error) {
	trimmed := strings.TrimSpace(rawKey)
	if trimmed == "" {
		return nil, fmt.Errorf("%w: api key is required", domain.ErrInvalidOrganization)
	}
	key, err := s.repo.GetAPIKeyByHash(ctx, hashOrganizationAPIKey(trimmed))
	if err != nil {
		return nil, fmt.Errorf("validate organization api key: %w", err)
	}
	now := s.now().UTC()
	if err := s.repo.MarkAPIKeyLastUsed(ctx, key.ID, now); err != nil {
		return nil, fmt.Errorf("mark organization api key used: %w", err)
	}
	key.Key = ""
	key.KeyHash = ""
	key.LastUsedAt = &now
	return key, nil
}

func (s *Service) RevokeOrganizationAPIKey(ctx context.Context, organizationID, keyID int64) error {
	if organizationID <= 0 || keyID <= 0 {
		return fmt.Errorf("%w: invalid organization or api key id", domain.ErrInvalidOrganization)
	}
	if err := s.repo.RevokeAPIKey(ctx, organizationID, keyID, s.now().UTC()); err != nil {
		return fmt.Errorf("revoke organization api key: %w", err)
	}
	return nil
}

func (s *Service) GetOrganizationHierarchy(ctx context.Context, organizationID int64) (OrganizationHierarchy, error) {
	return s.getOrganizationHierarchy(ctx, organizationID, 0)
}

func (s *Service) GetOrganizationHierarchyForUser(ctx context.Context, organizationID, userID int64) (OrganizationHierarchy, error) {
	if userID <= 0 {
		return OrganizationHierarchy{}, fmt.Errorf("%w: user id must be positive", domain.ErrInvalidMember)
	}
	return s.getOrganizationHierarchy(ctx, organizationID, userID)
}

func (s *Service) getOrganizationHierarchy(ctx context.Context, organizationID, userID int64) (OrganizationHierarchy, error) {
	if organizationID <= 0 {
		return OrganizationHierarchy{}, fmt.Errorf("%w: organization id must be positive", domain.ErrInvalidOrganization)
	}

	org, err := s.GetOrganization(ctx, organizationID)
	if err != nil {
		return OrganizationHierarchy{}, err
	}

	hierarchy := OrganizationHierarchy{Organization: *org}
	if s.projectLister == nil {
		return hierarchy, nil
	}

	var projects []ProjectSummary
	var projectErr error
	if userID > 0 {
		canManageAllProjects, err := s.userCanManageAllProjects(ctx, org, userID)
		if err != nil {
			return OrganizationHierarchy{}, err
		}
		if canManageAllProjects {
			projects, projectErr = s.projectLister.ListProjectsByOrganization(ctx, organizationID)
		} else if projectUserLister, ok := s.projectLister.(ProjectUserLister); ok {
			projects, projectErr = projectUserLister.ListProjectsByOrganizationForUser(ctx, organizationID, userID)
		} else {
			projects, projectErr = s.projectLister.ListProjectsByOrganization(ctx, organizationID)
		}
	} else {
		projects, projectErr = s.projectLister.ListProjectsByOrganization(ctx, organizationID)
	}
	if projectErr != nil {
		return OrganizationHierarchy{}, fmt.Errorf("list organization projects: %w", projectErr)
	}
	hierarchy.Projects = projects
	return hierarchy, nil
}

func (s *Service) userCanManageAllProjects(ctx context.Context, organization *domain.Organization, userID int64) (bool, error) {
	memberships, err := s.ListOrganizationsByUser(ctx, userID)
	if err != nil {
		return false, fmt.Errorf("list user organization roles: %w", err)
	}
	for _, membership := range memberships {
		if organization == nil || membership.OrganizationID != organization.ID {
			continue
		}
		for _, role := range membership.Roles {
			switch strings.TrimSpace(strings.ToLower(role)) {
			case domain.RoleEditor, domain.RoleSuperAdmin:
				return true, nil
			}
		}
	}
	return false, nil
}

func (s *Service) ListOrganizationsByUser(ctx context.Context, userID int64) ([]domain.Membership, error) {
	if userID <= 0 {
		return nil, fmt.Errorf("%w: user id must be positive", domain.ErrInvalidMember)
	}
	store, err := s.membershipStoreOrError()
	if err != nil {
		return nil, err
	}
	memberships, err := store.ListOrganizationsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list organizations by user: %w", err)
	}
	return memberships, nil
}

func (s *Service) AddMember(ctx context.Context, organizationID, userID int64) (*domain.Member, error) {
	member := &domain.Member{
		OrganizationID: organizationID,
		UserID:         userID,
		Roles:          []string{domain.RoleViewer},
		AddedAt:        s.now().UTC(),
	}
	if err := member.Validate(); err != nil {
		return nil, err
	}
	store, err := s.membershipStoreOrError()
	if err != nil {
		return nil, err
	}
	if err := store.UpsertMember(ctx, member); err != nil {
		return nil, fmt.Errorf("add member: %w", err)
	}

	return member, nil
}

func (s *Service) ListMembers(ctx context.Context, organizationID int64) ([]domain.Member, error) {
	if organizationID <= 0 {
		return nil, fmt.Errorf("%w: organization id must be positive", domain.ErrInvalidMember)
	}
	store, err := s.membershipStoreOrError()
	if err != nil {
		return nil, err
	}
	members, err := store.ListMembers(ctx, organizationID)
	if err != nil {
		return nil, fmt.Errorf("list members: %w", err)
	}
	if s.userProfileResolver != nil {
		for i := range members {
			profile, profileErr := s.userProfileResolver.UserProfile(ctx, members[i].UserID)
			if profileErr != nil {
				continue
			}
			members[i].Email = profile.Email
			members[i].FirstName = profile.FirstName
			members[i].LastName = profile.LastName
		}
	}
	return members, nil
}

func (s *Service) AssignRole(ctx context.Context, organizationID, userID int64, role string) (*domain.Member, error) {
	normalizedRole, err := domain.NormalizeRole(role)
	if err != nil {
		return nil, err
	}
	if organizationID <= 0 || userID <= 0 {
		return nil, fmt.Errorf("%w: invalid organization or user id", domain.ErrInvalidMember)
	}
	return s.ensureMemberRole(ctx, organizationID, userID, normalizedRole)
}

func (s *Service) UpdateMemberRoles(ctx context.Context, organizationID, userID int64, roles []string) (*domain.Member, error) {
	if organizationID <= 0 || userID <= 0 {
		return nil, fmt.Errorf("%w: invalid organization or user id", domain.ErrInvalidMember)
	}
	normalizedRoles, err := normalizeMemberRoles(roles)
	if err != nil {
		return nil, err
	}
	store, err := s.membershipStoreOrError()
	if err != nil {
		return nil, err
	}
	member, err := store.UpdateMemberRoles(ctx, organizationID, userID, normalizedRoles)
	if err != nil {
		return nil, fmt.Errorf("update member roles: %w", err)
	}
	return member, nil
}

func (s *Service) RemoveMember(ctx context.Context, organizationID, userID int64) error {
	if organizationID <= 0 || userID <= 0 {
		return fmt.Errorf("%w: invalid organization or user id", domain.ErrInvalidMember)
	}
	store, err := s.membershipStoreOrError()
	if err != nil {
		return err
	}
	if err := store.RemoveMember(ctx, organizationID, userID); err != nil {
		return fmt.Errorf("remove member: %w", err)
	}
	return nil
}

func normalizeMemberRoles(roles []string) ([]string, error) {
	normalized := make([]string, 0, len(roles))
	seen := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		next, err := domain.NormalizeRole(role)
		if err != nil {
			return nil, err
		}
		if _, exists := seen[next]; exists {
			continue
		}
		seen[next] = struct{}{}
		normalized = append(normalized, next)
	}
	if len(normalized) == 0 {
		return nil, fmt.Errorf("%w: at least one role is required", domain.ErrInvalidRole)
	}
	slices.Sort(normalized)
	return normalized, nil
}

func (s *Service) CreateInvitation(
	ctx context.Context,
	organizationID, invitedByUserID int64,
	email, locale, role, message string,
	expiresAt *time.Time,
) (*domain.Invitation, error) {
	return s.createInvitation(ctx, organizationID, invitedByUserID, email, locale, role, message, "", expiresAt)
}

func (s *Service) CreateProjectInvitation(
	ctx context.Context,
	organizationID, invitedByUserID int64,
	email, locale, role, message, projectID string,
	expiresAt *time.Time,
) (*domain.Invitation, error) {
	if strings.TrimSpace(projectID) == "" {
		return nil, fmt.Errorf("%w: project id is required", domain.ErrInvalidInvitation)
	}
	return s.createInvitation(ctx, organizationID, invitedByUserID, email, locale, role, message, strings.TrimSpace(projectID), expiresAt)
}

func (s *Service) createInvitation(
	ctx context.Context,
	organizationID, invitedByUserID int64,
	email, locale, role, message, projectID string,
	expiresAt *time.Time,
) (*domain.Invitation, error) {
	normalizedEmail, err := domain.NormalizeInvitationEmail(email)
	if err != nil {
		return nil, err
	}

	normalizedRole := domain.RoleViewer
	if strings.TrimSpace(role) != "" {
		normalizedRole, err = domain.NormalizeRole(role)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", domain.ErrInvalidInvitation, err)
		}
	}
	token, err := generateSecureTokenHex(24)
	if err != nil {
		return nil, fmt.Errorf("generate invitation token: %w", err)
	}

	now := s.now().UTC()
	invitation := &domain.Invitation{
		OrganizationID:  organizationID,
		ProjectID:       strings.TrimSpace(projectID),
		Email:           normalizedEmail,
		Locale:          domain.NormalizeInvitationLocale(locale),
		Role:            normalizedRole,
		Token:           token,
		Message:         strings.TrimSpace(message),
		Status:          domain.InvitationStatusPending,
		InvitedByUserID: invitedByUserID,
		CreatedAt:       now,
		ExpiresAt:       copyTimePtrUTC(defaultInvitationExpiry(now, expiresAt)),
	}
	if err := invitation.ValidateForCreate(); err != nil {
		return nil, err
	}

	if err := s.repo.CreateInvitation(ctx, invitation); err != nil {
		return nil, fmt.Errorf("create invitation: %w", err)
	}
	if err := s.sendInvitationNotification(ctx, invitation); err != nil {
		return nil, err
	}
	return invitation, nil
}

func (s *Service) sendInvitationNotification(ctx context.Context, invitation *domain.Invitation) error {
	if s.invitationNotifier == nil || invitation == nil {
		return nil
	}
	if skip, err := s.shouldSkipInvitationNotification(ctx, invitation); err == nil && skip {
		return nil
	}

	organizationName := fmt.Sprintf("organisation #%d", invitation.OrganizationID)
	if org, err := s.repo.GetByID(ctx, invitation.OrganizationID); err == nil && strings.TrimSpace(org.Name) != "" {
		organizationName = strings.TrimSpace(org.Name)
	}
	projectName := s.resolveInvitationProjectName(ctx, invitation)

	if err := s.invitationNotifier.SendInvitation(ctx, InvitationNotification{
		Email:            invitation.Email,
		OrganizationID:   invitation.OrganizationID,
		OrganizationName: organizationName,
		Locale:           invitation.Locale,
		Role:             invitation.Role,
		Message:          invitation.Message,
		ProjectName:      projectName,
		AcceptURL:        s.buildInvitationAcceptURL(invitation.Token),
		ExpiresAt:        copyTimePtrUTC(invitation.ExpiresAt),
	}); err != nil {
		return fmt.Errorf("send invitation notification: %w", err)
	}
	return nil
}

func (s *Service) resolveInvitationProjectName(ctx context.Context, invitation *domain.Invitation) string {
	if invitation == nil {
		return ""
	}
	projectID := strings.TrimSpace(invitation.ProjectID)
	if projectID == "" {
		return ""
	}
	if s.projectLister == nil {
		return projectID
	}
	projects, err := s.projectLister.ListProjectsByOrganization(ctx, invitation.OrganizationID)
	if err != nil {
		return projectID
	}
	for _, project := range projects {
		if strings.TrimSpace(project.ID) == projectID && strings.TrimSpace(project.Name) != "" {
			return strings.TrimSpace(project.Name)
		}
	}
	return projectID
}

func (s *Service) shouldSkipInvitationNotification(ctx context.Context, invitation *domain.Invitation) (bool, error) {
	if invitation == nil || s.membershipStore == nil {
		return false, nil
	}

	invitationEmail, err := domain.NormalizeInvitationEmail(invitation.Email)
	if err != nil {
		return false, err
	}

	members, err := s.ListMembers(ctx, invitation.OrganizationID)
	if err != nil {
		return false, err
	}
	for _, member := range members {
		if member.DeletedAt != nil {
			continue
		}
		memberEmail, ok, err := s.resolveMemberEmail(ctx, member)
		if err != nil {
			return false, err
		}
		if ok && memberEmail == invitationEmail {
			return true, nil
		}
	}

	return false, nil
}

func (s *Service) resolveMemberEmail(ctx context.Context, member domain.Member) (string, bool, error) {
	if normalizedEmail, ok, err := normalizeOptionalInvitationEmail(member.Email); err != nil {
		return "", false, err
	} else if ok {
		return normalizedEmail, true, nil
	}

	if s.userProfileResolver != nil {
		profile, err := s.userProfileResolver.UserProfile(ctx, member.UserID)
		if err != nil {
			return "", false, err
		}
		return normalizeOptionalInvitationEmail(profile.Email)
	}
	if s.userEmailResolver != nil {
		email, err := s.userEmailResolver.UserEmail(ctx, member.UserID)
		if err != nil {
			return "", false, err
		}
		return normalizeOptionalInvitationEmail(email)
	}

	return "", false, nil
}

func normalizeOptionalInvitationEmail(raw string) (string, bool, error) {
	if strings.TrimSpace(raw) == "" {
		return "", false, nil
	}
	normalized, err := domain.NormalizeInvitationEmail(raw)
	if err != nil {
		return "", false, err
	}
	return normalized, true, nil
}

func defaultInvitationExpiry(now time.Time, expiresAt *time.Time) *time.Time {
	if expiresAt != nil {
		return expiresAt
	}
	defaultExpiresAt := now.Add(7 * 24 * time.Hour)
	return &defaultExpiresAt
}

func normalizeInvitationLoginURL(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return trimmed
	}
	if strings.HasSuffix(parsed.Path, "/auth") {
		parsed.Path = strings.TrimSuffix(parsed.Path, "/auth") + "/login"
	}
	return parsed.String()
}

func (s *Service) buildInvitationAcceptURL(token string) string {
	token = strings.TrimSpace(token)
	if s.invitationAppBaseURL == "" || token == "" {
		return ""
	}
	appInvitationURL := s.invitationAppBaseURL + "/invitations/" + url.PathEscape(token)
	if s.invitationLoginURL == "" {
		return appInvitationURL
	}
	loginURL, err := url.Parse(normalizeInvitationLoginURL(s.invitationLoginURL))
	if err != nil {
		return appInvitationURL
	}
	query := loginURL.Query()
	query.Set("return_to", appInvitationURL)
	loginURL.RawQuery = query.Encode()
	return loginURL.String()
}

func (s *Service) ListInvitations(ctx context.Context, organizationID int64) ([]domain.Invitation, error) {
	if organizationID <= 0 {
		return nil, fmt.Errorf("%w: organization id must be positive", domain.ErrInvalidInvitation)
	}
	invitations, err := s.repo.ListInvitations(ctx, organizationID)
	if err != nil {
		return nil, fmt.Errorf("list invitations: %w", err)
	}
	return invitations, nil
}

func (s *Service) GetInvitation(ctx context.Context, organizationID, invitationID int64) (*domain.Invitation, error) {
	if organizationID <= 0 || invitationID <= 0 {
		return nil, fmt.Errorf("%w: invalid organization or invitation id", domain.ErrInvalidInvitation)
	}
	invitation, err := s.repo.GetInvitationByID(ctx, organizationID, invitationID)
	if err != nil {
		return nil, fmt.Errorf("get invitation: %w", err)
	}
	return invitation, nil
}

func (s *Service) UpdateInvitation(
	ctx context.Context,
	organizationID, invitationID int64,
	email, locale, role, message string,
	expiresAt *time.Time,
) (*domain.Invitation, error) {
	if organizationID <= 0 || invitationID <= 0 {
		return nil, fmt.Errorf("%w: invalid organization or invitation id", domain.ErrInvalidInvitation)
	}
	normalizedEmail, err := domain.NormalizeInvitationEmail(email)
	if err != nil {
		return nil, err
	}
	normalizedRole, err := domain.NormalizeRole(role)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", domain.ErrInvalidInvitation, err)
	}
	invitation := &domain.Invitation{
		ID:             invitationID,
		OrganizationID: organizationID,
		Email:          normalizedEmail,
		Locale:         domain.NormalizeInvitationLocale(locale),
		Role:           normalizedRole,
		Message:        strings.TrimSpace(message),
		ExpiresAt:      copyTimePtrUTC(defaultInvitationExpiry(s.now().UTC(), expiresAt)),
	}
	updated, err := s.repo.UpdateInvitation(ctx, invitation)
	if err != nil {
		return nil, fmt.Errorf("update invitation: %w", err)
	}
	if err := s.sendInvitationNotification(ctx, updated); err != nil {
		return nil, err
	}
	return updated, nil
}

func (s *Service) DeleteInvitation(ctx context.Context, organizationID, invitationID int64) error {
	if organizationID <= 0 || invitationID <= 0 {
		return fmt.Errorf("%w: invalid organization or invitation id", domain.ErrInvalidInvitation)
	}
	if err := s.repo.DeleteInvitation(ctx, organizationID, invitationID); err != nil {
		return fmt.Errorf("delete invitation: %w", err)
	}
	return nil
}

func (s *Service) AcceptInvitation(ctx context.Context, token string, userID int64) (*domain.Invitation, *domain.Member, error) {
	trimmedToken := strings.TrimSpace(token)
	if trimmedToken == "" || userID <= 0 {
		return nil, nil, fmt.Errorf("%w: token and user id are required", domain.ErrInvalidInvitation)
	}
	if s.userEmailResolver != nil {
		if err := s.validateInvitationUserEmail(ctx, trimmedToken, userID); err != nil {
			return nil, nil, err
		}
	}
	invitation, member, err := s.repo.AcceptInvitationByToken(ctx, trimmedToken, userID, s.now().UTC())
	if err != nil {
		return nil, nil, fmt.Errorf("accept invitation: %w", err)
	}
	if s.membershipStore != nil {
		orgRole := invitation.Role
		if strings.TrimSpace(invitation.ProjectID) != "" {
			orgRole = domain.RoleViewer
		}
		member, err = s.ensureMemberRole(ctx, invitation.OrganizationID, userID, orgRole)
		if err != nil {
			return nil, nil, fmt.Errorf("sync invited member permissions: %w", err)
		}
	}
	if strings.TrimSpace(invitation.ProjectID) != "" {
		if _, err := s.AssignProjectMember(
			ctx,
			invitation.ProjectID,
			invitation.OrganizationID,
			userID,
			invitation.Role,
		); err != nil {
			return nil, nil, fmt.Errorf("assign project invitation member: %w", err)
		}
	}
	return invitation, member, nil
}

func (s *Service) validateInvitationUserEmail(ctx context.Context, token string, userID int64) error {
	invitation, err := s.repo.GetInvitationByToken(ctx, token)
	if err != nil {
		return fmt.Errorf("get invitation before accept: %w", err)
	}
	userEmail, err := s.userEmailResolver.UserEmail(ctx, userID)
	if err != nil {
		return fmt.Errorf("resolve invitation user email: %w", err)
	}
	invitationEmail, err := domain.NormalizeInvitationEmail(invitation.Email)
	if err != nil {
		return fmt.Errorf("%w: stored invitation email is invalid", domain.ErrInvalidInvitation)
	}
	normalizedUserEmail, err := domain.NormalizeInvitationEmail(userEmail)
	if err != nil {
		return fmt.Errorf("%w: authenticated user email is invalid", domain.ErrInvalidInvitation)
	}
	if normalizedUserEmail != invitationEmail {
		return domain.ErrInvitationEmailMismatch
	}
	return nil
}

func (s *Service) RefuseInvitation(ctx context.Context, token string, userID int64) (*domain.Invitation, error) {
	trimmedToken := strings.TrimSpace(token)
	if trimmedToken == "" || userID <= 0 {
		return nil, fmt.Errorf("%w: token and user id are required", domain.ErrInvalidInvitation)
	}
	invitation, err := s.repo.RefuseInvitationByToken(ctx, trimmedToken, userID, s.now().UTC())
	if err != nil {
		return nil, fmt.Errorf("refuse invitation: %w", err)
	}
	return invitation, nil
}

func copyTimePtrUTC(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	clone := value.UTC()
	return &clone
}

func generateSecureTokenHex(size int) (string, error) {
	if size <= 0 {
		return "", fmt.Errorf("invalid token size")
	}
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func generateOrganizationAPIKey() (string, error) {
	token, err := generateSecureTokenHex(32)
	if err != nil {
		return "", fmt.Errorf("generate organization api key: %w", err)
	}
	return "org_" + token, nil
}

func generateOrganizationPublicID() (string, error) {
	token, err := generateSecureTokenHex(12)
	if err != nil {
		return "", err
	}
	return "org_" + token, nil
}

func hashOrganizationAPIKey(value string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(value)))
	return hex.EncodeToString(sum[:])
}

func apiKeyPrefix(value string) string {
	value = strings.TrimSpace(value)
	if len(value) <= 12 {
		return value
	}
	return value[:12]
}

func (s *Service) ensureMemberRole(ctx context.Context, organizationID, userID int64, role string) (*domain.Member, error) {
	members, err := s.ListMembers(ctx, organizationID)
	if err != nil {
		return nil, err
	}

	roles := []string{role}
	for _, member := range members {
		if member.UserID != userID {
			continue
		}
		roles = append(member.Roles, role)
		break
	}

	return s.syncMemberRoles(ctx, organizationID, userID, roles)
}

func (s *Service) syncMemberRoles(ctx context.Context, organizationID, userID int64, roles []string) (*domain.Member, error) {
	normalizedRoles, err := normalizeMemberRoles(roles)
	if err != nil {
		return nil, err
	}

	store, err := s.membershipStoreOrError()
	if err != nil {
		return nil, err
	}

	members, listErr := store.ListMembers(ctx, organizationID)
	if listErr == nil {
		for _, existing := range members {
			if existing.UserID == userID {
				return store.UpdateMemberRoles(ctx, organizationID, userID, normalizedRoles)
			}
		}
	}

	member := &domain.Member{
		OrganizationID: organizationID,
		UserID:         userID,
		Roles:          normalizedRoles,
		AddedAt:        s.now().UTC(),
	}
	if err := store.UpsertMember(ctx, member); err != nil {
		return nil, err
	}
	return member, nil
}

func (s *Service) membershipStoreOrError() (MembershipStore, error) {
	if s.membershipStore == nil {
		return nil, fmt.Errorf("permission membership store is not configured")
	}
	return s.membershipStore, nil
}
