import { Sequelize, DataTypes } from 'sequelize';

export const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  { host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), dialect: 'mysql', logging: false }
);

export const Role = sequelize.define('Role', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: DataTypes.STRING,
  isSystem: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'role', timestamps: false });

export const MenuItem = sequelize.define('MenuItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  key: { type: DataTypes.STRING, allowNull: false, unique: true },
  label: { type: DataTypes.STRING, allowNull: false },
  icon: DataTypes.STRING,
  path: DataTypes.STRING,
  parentId: DataTypes.INTEGER,
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'menuitem', timestamps: false });

export const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  phone: DataTypes.STRING,
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  roleId: { type: DataTypes.INTEGER, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastLoginAt: DataTypes.DATE,
  otpCode: DataTypes.STRING,
  otpExpiresAt: DataTypes.DATE,
  createdAt: DataTypes.DATE,
}, { tableName: 'user', timestamps: false });

export const RolePermission = sequelize.define('RolePermission', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  roleId: { type: DataTypes.INTEGER, allowNull: false },
  menuItemId: { type: DataTypes.INTEGER, allowNull: false },
  canView: { type: DataTypes.BOOLEAN, defaultValue: false },
  canCreate: { type: DataTypes.BOOLEAN, defaultValue: false },
  canEdit: { type: DataTypes.BOOLEAN, defaultValue: false },
  canDelete: { type: DataTypes.BOOLEAN, defaultValue: false },
  canExport: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'rolepermission', timestamps: false });

export const UserPermission = sequelize.define('UserPermission', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  menuItemId: { type: DataTypes.INTEGER, allowNull: false },
  canView: { type: DataTypes.BOOLEAN, defaultValue: false },
  canCreate: { type: DataTypes.BOOLEAN, defaultValue: false },
  canEdit: { type: DataTypes.BOOLEAN, defaultValue: false },
  canDelete: { type: DataTypes.BOOLEAN, defaultValue: false },
  canExport: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'userpermission', timestamps: false });

export const LookupType = sequelize.define('LookupType', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  isPosMenu: { type: DataTypes.BOOLEAN, defaultValue: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'lookuptype', timestamps: false });

export const LookupValue = sequelize.define('LookupValue', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  typeId: { type: DataTypes.INTEGER, allowNull: false },
  parentId: DataTypes.INTEGER,
  nameEn: { type: DataTypes.STRING, allowNull: false },
  nameTa: DataTypes.STRING,
  price: DataTypes.DECIMAL(10, 2),
  depositPct: DataTypes.INTEGER,
  meta: DataTypes.JSON,
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'lookupvalue', timestamps: false });

export const Devotee = sequelize.define('Devotee', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  phone: DataTypes.STRING,
  altPhone: DataTypes.STRING,
  icNumber: DataTypes.STRING,
  address: DataTypes.STRING,
  addressTa: DataTypes.STRING,
  email: DataTypes.STRING,
  memberType: DataTypes.STRING,
  membershipTypeId: DataTypes.INTEGER,
  membershipTypeLabel: DataTypes.STRING,
  membershipPrice: DataTypes.DECIMAL(10, 2),
  membershipMonths: DataTypes.INTEGER,
  membershipStartDate: DataTypes.DATEONLY,
  membershipEndDate: DataTypes.DATEONLY,
  membershipPaidVia: DataTypes.STRING,
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  createdAt: DataTypes.DATE,
}, { tableName: 'devotee', timestamps: false });

export const DevoteeMembership = sequelize.define('DevoteeMembership', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  devoteeId: { type: DataTypes.INTEGER, allowNull: false },
  membershipTypeId: DataTypes.INTEGER,
  membershipTypeLabel: DataTypes.STRING,
  membershipPrice: DataTypes.DECIMAL(10, 2),
  membershipMonths: DataTypes.INTEGER,
  membershipUnit: DataTypes.STRING,
  membershipStartDate: DataTypes.DATEONLY,
  membershipEndDate: DataTypes.DATEONLY,
  membershipPaidVia: DataTypes.STRING,
  createdAt: DataTypes.DATE,
}, { tableName: 'devoteemembership', timestamps: false });

export const DevoteeNote = sequelize.define('DevoteeNote', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  devoteeId: { type: DataTypes.INTEGER, allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: false },
  createdById: { type: DataTypes.INTEGER, allowNull: false },
  createdAt: DataTypes.DATE,
}, { tableName: 'devoteenote', timestamps: false });

export const Transaction = sequelize.define('Transaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  clientUuid: { type: DataTypes.STRING, allowNull: false, unique: true },
  receiptNo: { type: DataTypes.STRING, allowNull: false, unique: true },
  localChitNo: DataTypes.STRING,
  kind: { type: DataTypes.STRING, allowNull: false },
  devoteeId: DataTypes.INTEGER,
  devoteeName: DataTypes.STRING,
  starNatchathiram: DataTypes.STRING,
  total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  paymentMode: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'PAID' },
  bookingId: DataTypes.INTEGER,
  createdById: { type: DataTypes.INTEGER, allowNull: false },
  deviceId: DataTypes.STRING,
  txDate: DataTypes.DATE,
  syncedAt: DataTypes.DATE,
}, { tableName: 'transaction', timestamps: false });

export const TransactionItem = sequelize.define('TransactionItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  transactionId: { type: DataTypes.INTEGER, allowNull: false },
  lookupValueId: { type: DataTypes.INTEGER, allowNull: false },
  nameSnapshot: { type: DataTypes.STRING, allowNull: false },
  nameTa: DataTypes.STRING,
  priceSnapshot: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  qty: { type: DataTypes.INTEGER, defaultValue: 1 },
  lineTotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
}, { tableName: 'transactionitem', timestamps: false });

export const HallBooking = sequelize.define('HallBooking', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  clientUuid: { type: DataTypes.STRING, allowNull: false, unique: true },
  bookingNo: { type: DataTypes.STRING, allowNull: false, unique: true },
  devoteeId: { type: DataTypes.INTEGER, allowNull: false },
  eventTypeId: DataTypes.INTEGER,
  eventDate: DataTypes.DATE,
  startTime: DataTypes.DATE,
  endTime: DataTypes.DATE,
  hallRate: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  depositDue: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  depositPaidAt: DataTypes.DATE,
  balanceDueAt: DataTypes.DATE,
  balancePaidAt: DataTypes.DATE,
  status: { type: DataTypes.STRING, defaultValue: 'PENDING_DEPOSIT' },
  notes: DataTypes.TEXT,
  createdAt: DataTypes.DATE,
}, { tableName: 'hallbooking', timestamps: false });

export const BookingNote = sequelize.define('BookingNote', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  bookingId: { type: DataTypes.INTEGER, allowNull: false },
  note: { type: DataTypes.TEXT, allowNull: false },
  createdById: { type: DataTypes.INTEGER, allowNull: false },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, { tableName: 'bookingnote', timestamps: false });

export const BookingCancelNote = sequelize.define('BookingCancelNote', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  bookingId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  note: { type: DataTypes.TEXT, allowNull: false },
  cancelledById: { type: DataTypes.INTEGER, allowNull: false },
  createdAt: DataTypes.DATE,
}, { tableName: 'bookingcancelnote', timestamps: false });

export const Reminder = sequelize.define('Reminder', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  bookingId: { type: DataTypes.INTEGER, allowNull: false },
  channel: { type: DataTypes.STRING, defaultValue: 'WHATSAPP' },
  scheduledAt: DataTypes.DATE,
  sentAt: DataTypes.DATE,
  status: { type: DataTypes.STRING, defaultValue: 'SCHEDULED' },
}, { tableName: 'reminder', timestamps: false });

export const Setting = sequelize.define('Setting', {
  key: { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.JSON, allowNull: false },
}, { tableName: 'setting', timestamps: false });

export const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  action: { type: DataTypes.STRING, allowNull: false },
  entity: { type: DataTypes.STRING, allowNull: false },
  entityId: DataTypes.STRING,
  before: DataTypes.JSON,
  after: DataTypes.JSON,
  ip: DataTypes.STRING,
  createdAt: DataTypes.DATE,
}, { tableName: 'auditlog', timestamps: false });

// ── Associations ──
Role.hasMany(User, { foreignKey: 'roleId' });
User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

Role.hasMany(RolePermission, { foreignKey: 'roleId', as: 'permissions' });
RolePermission.belongsTo(Role, { foreignKey: 'roleId' });

MenuItem.hasMany(RolePermission, { foreignKey: 'menuItemId' });
RolePermission.belongsTo(MenuItem, { foreignKey: 'menuItemId', as: 'menuItem' });

User.hasMany(UserPermission, { foreignKey: 'userId', as: 'permissions' });
UserPermission.belongsTo(User, { foreignKey: 'userId' });

MenuItem.hasMany(UserPermission, { foreignKey: 'menuItemId' });
UserPermission.belongsTo(MenuItem, { foreignKey: 'menuItemId', as: 'menuItem' });

LookupType.hasMany(LookupValue, { foreignKey: 'typeId', as: 'values' });
LookupValue.belongsTo(LookupType, { foreignKey: 'typeId' });

LookupValue.hasMany(LookupValue, { foreignKey: 'parentId', as: 'children' });
LookupValue.belongsTo(LookupValue, { foreignKey: 'parentId', as: 'parent' });

Devotee.hasMany(Transaction, { foreignKey: 'devoteeId' });
Transaction.belongsTo(Devotee, { foreignKey: 'devoteeId', as: 'devotee' });

Devotee.hasMany(HallBooking, { foreignKey: 'devoteeId' });
HallBooking.belongsTo(Devotee, { foreignKey: 'devoteeId', as: 'devotee' });

Devotee.hasMany(DevoteeMembership, { foreignKey: 'devoteeId', as: 'memberships' });
DevoteeMembership.belongsTo(Devotee, { foreignKey: 'devoteeId' });

Devotee.hasMany(DevoteeNote, { foreignKey: 'devoteeId' });
DevoteeNote.belongsTo(Devotee, { foreignKey: 'devoteeId' });

User.hasMany(DevoteeNote, { foreignKey: 'createdById' });
DevoteeNote.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });

User.hasMany(Transaction, { foreignKey: 'createdById' });
Transaction.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });

Transaction.hasMany(TransactionItem, { foreignKey: 'transactionId', as: 'items' });
TransactionItem.belongsTo(Transaction, { foreignKey: 'transactionId' });

HallBooking.hasMany(Transaction, { foreignKey: 'bookingId', as: 'transactions' });
Transaction.belongsTo(HallBooking, { foreignKey: 'bookingId', as: 'booking' });

HallBooking.hasMany(Reminder, { foreignKey: 'bookingId', as: 'reminders' });
Reminder.belongsTo(HallBooking, { foreignKey: 'bookingId', as: 'booking' });

HallBooking.hasMany(BookingNote, { foreignKey: 'bookingId', as: 'bookingNotes' });
BookingNote.belongsTo(HallBooking, { foreignKey: 'bookingId' });

User.hasMany(BookingNote, { foreignKey: 'createdById' });
BookingNote.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });

HallBooking.hasOne(BookingCancelNote, { foreignKey: 'bookingId', as: 'cancelNote' });
BookingCancelNote.belongsTo(HallBooking, { foreignKey: 'bookingId' });

User.hasMany(BookingCancelNote, { foreignKey: 'cancelledById' });
BookingCancelNote.belongsTo(User, { foreignKey: 'cancelledById', as: 'cancelledBy' });

User.hasMany(AuditLog, { foreignKey: 'userId' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
