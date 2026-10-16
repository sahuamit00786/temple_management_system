export function can(menuKey, action = 'view') {
  return (req, res, next) => {
    if (req.user.role.name === 'Superadmin') return next();
    const perm = req.user.permissions.find((p) => p.menuItem.key === menuKey)
      || req.user.role.permissions.find((p) => p.menuItem.key === menuKey);
    const ok = perm && (action === 'view' || perm.canView) && {
      view: perm.canView, create: perm.canCreate, edit: perm.canEdit,
      delete: perm.canDelete, export: perm.canExport,
    }[action];
    if (!ok) return res.status(403).json({ error: 'You do not have permission for this action' });
    next();
  };
}
