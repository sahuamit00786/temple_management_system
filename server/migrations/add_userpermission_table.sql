-- Run this once on your MySQL database to support per-staff menu permission overrides
-- (previously permissions were role-only, so all staff sharing a role always had identical access)
CREATE TABLE IF NOT EXISTS userpermission (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  menuItemId INT NOT NULL,
  canView TINYINT(1) NOT NULL DEFAULT 0,
  canCreate TINYINT(1) NOT NULL DEFAULT 0,
  canEdit TINYINT(1) NOT NULL DEFAULT 0,
  canDelete TINYINT(1) NOT NULL DEFAULT 0,
  canExport TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_userpermission_user_menu (userId, menuItemId),
  CONSTRAINT fk_userpermission_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_userpermission_menuitem FOREIGN KEY (menuItemId) REFERENCES menuitem(id) ON DELETE CASCADE
);
