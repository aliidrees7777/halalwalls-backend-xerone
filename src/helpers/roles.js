/**
 * Central role definitions for HalalWalls RBAC.
 *
 *   • admin — admin endpoints only (catalog management, moderation).
 *   • user  — standard account (browse, download, favorites).
 *
 * Public endpoints (catalog/auth) are open and not role-gated.
 *
 * Identification: the JWT carries `role`, but authorize() always re-loads the
 * user from the DB and uses the DB role as the source of truth.
 */
const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
};

const ALL_ROLES = Object.values(ROLES);

// Roles a NEW account may self-register as (admins are provisioned internally).
const SIGNUP_ROLES = [ROLES.USER];

module.exports = { ROLES, ALL_ROLES, SIGNUP_ROLES };
