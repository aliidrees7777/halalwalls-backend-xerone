// Role service — the admin Roles & Permissions management layer. Defines the
// permission catalog, seeds 5 default roles on first use, and handles CRUD.
// NOTE: this is a management/definition layer; the API's runtime access guard
// still uses User.role (user/admin). Enforcing these grants per-route is a
// separate, larger effort.
const prisma = require('../lib/prisma');

const fail = (m, s) => { const e = new Error(m); e.statusCode = s; return e; };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const assertUuid = (id) => { if (!UUID_RE.test(String(id))) throw fail('Invalid role id', 400); };
const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The permission catalog (modules → permissions). "System Permissions" count.
const CATALOG = [
  { module: 'Dashboard', permissions: [
    { key: 'dashboard.view', label: 'View Dashboard' },
    { key: 'dashboard.stats', label: 'View Statistics' },
    { key: 'dashboard.export', label: 'Export Data' },
    { key: 'dashboard.announcements', label: 'Manage Announcements' },
  ] },
  { module: 'Wallpapers', permissions: [
    { key: 'wallpapers.view', label: 'View Wallpapers' },
    { key: 'wallpapers.upload', label: 'Upload Wallpapers' },
    { key: 'wallpapers.edit', label: 'Edit Wallpapers' },
    { key: 'wallpapers.delete', label: 'Delete Wallpapers' },
    { key: 'wallpapers.moderate', label: 'Approve / Reject Wallpapers' },
  ] },
  { module: 'Categories & Tags', permissions: [
    { key: 'cattags.view', label: 'View Categories & Tags' },
    { key: 'cattags.edit', label: 'Create / Edit' },
    { key: 'cattags.delete', label: 'Delete' },
  ] },
  { module: 'Resolutions', permissions: [
    { key: 'resolutions.view', label: 'View Resolutions' },
    { key: 'resolutions.edit', label: 'Create / Edit' },
    { key: 'resolutions.delete', label: 'Delete' },
  ] },
  { module: 'Users & Access', permissions: [
    { key: 'users.view', label: 'View Users' },
    { key: 'users.edit', label: 'Create / Edit Users' },
    { key: 'users.delete', label: 'Delete Users' },
    { key: 'roles.manage', label: 'Manage Roles & Permissions' },
  ] },
  { module: 'Subscriptions & Payments', permissions: [
    { key: 'subscriptions.view', label: 'View Subscribers' },
    { key: 'payments.view', label: 'View Payments' },
    { key: 'payments.refund', label: 'Issue Refunds' },
    { key: 'plans.manage', label: 'Manage Plans' },
  ] },
  { module: 'Ads', permissions: [
    { key: 'ads.view', label: 'View Ads' },
    { key: 'ads.manage', label: 'Manage Ads' },
  ] },
  { module: 'Settings', permissions: [
    { key: 'settings.view', label: 'View Settings' },
    { key: 'settings.manage', label: 'Manage Settings' },
  ] },
];

const ALL_KEYS = CATALOG.flatMap((m) => m.permissions.map((p) => p.key));
const VIEW_KEYS = ALL_KEYS.filter((k) => k.endsWith('.view')).concat(['dashboard.stats']);
const has = (...keys) => keys;

const DEFAULT_ROLES = [
  { name: 'Super Admin', key: 'super-admin', description: 'Full, unrestricted access to everything.', isSystem: true, permissions: ALL_KEYS },
  { name: 'Admin', key: 'admin', description: 'Administrator — everything except refunds & system settings.', isSystem: true, permissions: ALL_KEYS.filter((k) => !['payments.refund', 'settings.manage'].includes(k)) },
  { name: 'Moderator', key: 'moderator', description: 'Moderates content and reviews submissions.', isSystem: true, permissions: [...VIEW_KEYS, 'wallpapers.upload', 'wallpapers.edit', 'wallpapers.delete', 'wallpapers.moderate', 'cattags.edit', 'resolutions.edit'] },
  { name: 'Editor', key: 'editor', description: 'Creates and edits content (no deletes or moderation).', isSystem: true, permissions: [...VIEW_KEYS, 'wallpapers.upload', 'wallpapers.edit', 'cattags.edit', 'resolutions.edit'] },
  { name: 'Viewer', key: 'viewer', description: 'Read-only access.', isSystem: true, permissions: VIEW_KEYS },
];

// Seed the 5 default roles once (idempotent).
async function ensureSeeded() {
  const count = await prisma.adminRole.count();
  if (count > 0) return;
  // eslint-disable-next-line no-restricted-syntax
  for (const r of DEFAULT_ROLES) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.adminRole.create({ data: r });
  }
}

// GET /admin/roles — roles + permission catalog + headline stats.
exports.getPage = async () => {
  await ensureSeeded();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [roles, admins, newThisMonth] = await Promise.all([
    prisma.adminRole.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.adminRole.count({ where: { createdAt: { gte: startOfMonth } } }),
  ]);
  return {
    message: 'Roles fetched',
    data: {
      roles,
      catalog: CATALOG,
      stats: {
        totalRoles: roles.length,
        newThisMonth,
        systemPermissions: ALL_KEYS.length,
        customRoles: roles.filter((r) => !r.isSystem).length,
        admins,
      },
    },
    statusCode: 200,
  };
};

exports.createRole = async (body = {}) => {
  const name = body.name && String(body.name).trim();
  if (!name) throw fail('Role name is required', 400);
  const key = slugify(name);
  if (!key) throw fail('Could not derive a valid key from the name', 400);
  if (await prisma.adminRole.findFirst({ where: { OR: [{ name }, { key }] } })) {
    throw fail('A role with this name already exists', 409);
  }
  const permissions = Array.isArray(body.permissions) ? body.permissions.filter((k) => ALL_KEYS.includes(k)) : [];
  const role = await prisma.adminRole.create({
    data: { name, key, description: body.description ? String(body.description).trim() : '', permissions, isSystem: false },
  });
  return { message: 'Role created', data: { role }, statusCode: 201 };
};

exports.updateRole = async (id, body = {}) => {
  assertUuid(id);
  const data = {};
  if (body.description !== undefined) data.description = String(body.description).trim();
  if (Array.isArray(body.permissions)) data.permissions = body.permissions.filter((k) => ALL_KEYS.includes(k));
  if (body.name !== undefined && String(body.name).trim()) {
    data.name = String(body.name).trim();
    data.key = slugify(data.name);
  }
  if (Object.keys(data).length === 0) throw fail('No valid fields to update', 400);
  let role;
  try {
    role = await prisma.adminRole.update({ where: { id }, data });
  } catch (e) {
    if (e.code === 'P2025') throw fail('Role not found', 404);
    throw e;
  }
  return { message: 'Role updated', data: { role }, statusCode: 200 };
};

exports.deleteRole = async (id) => {
  assertUuid(id);
  const role = await prisma.adminRole.findUnique({ where: { id } });
  if (!role) throw fail('Role not found', 404);
  if (role.isSystem) throw fail('System roles cannot be deleted', 400);
  await prisma.adminRole.delete({ where: { id } });
  return { message: 'Role deleted', data: { id }, statusCode: 200 };
};

exports.CATALOG = CATALOG;
