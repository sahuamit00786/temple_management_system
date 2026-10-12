import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

const MENUS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/', sortOrder: 1 },
  { key: 'pos', label: 'Counter (POS)', icon: 'ReceiptText', path: '/pos', sortOrder: 2 },
  { key: 'bookings', label: 'Hall Booking', icon: 'CalendarDays', path: '/bookings', sortOrder: 3 },
  { key: 'devotees', label: 'Organization members', icon: 'Users', path: '/devotees', sortOrder: 4 },
  { key: 'reports', label: 'Reports', icon: 'BarChart3', path: '/reports', sortOrder: 5 },
  { key: 'lookups', label: 'Lookups', icon: 'ListTree', path: '/lookups', sortOrder: 6 },
  { key: 'users', label: 'User Management', icon: 'ShieldCheck', path: '/users', sortOrder: 7 },
  { key: 'settings', label: 'Settings', icon: 'Settings', path: '/settings', sortOrder: 8 },
];

const LOOKUP_TYPES = [
  { code: 'ARCHANAI', name: 'Archanai / Ubhayam Types' },
  { code: 'DONATION', name: 'Donation Categories' },
  { code: 'ANNADHANAM', name: 'Annadhanam Types' },
  { code: 'PAYMENT_MODE', name: 'POS Payment Modes' },
  { code: 'BOOKING_PAYMENT_MODE', name: 'Booking Payment Modes' },
  { code: 'NATCHATHIRAM', name: 'Natchathiram (Stars)' },
  { code: 'MEMBERSHIP_TYPE', name: 'Membership Types' },
];

async function main() {
  // ---- Roles ----
  const [superadmin, manager, staff] = await Promise.all([
    db.role.upsert({ where: { name: 'Superadmin' }, update: {}, create: { name: 'Superadmin', isSystem: true, description: 'Full access to everything' } }),
    db.role.upsert({ where: { name: 'Manager' }, update: {}, create: { name: 'Manager', isSystem: true, description: 'Operations, reports and lookups' } }),
    db.role.upsert({ where: { name: 'Staff' }, update: {}, create: { name: 'Staff', isSystem: true, description: 'Counter billing' } }),
  ]);

  // ---- Menus ----
  for (const m of MENUS) {
    await db.menuItem.upsert({ where: { key: m.key }, update: m, create: m });
  }
  const menuItems = await db.menuItem.findMany();

  // ---- Permissions ----
  const grant = async (roleId, keys, perms) => {
    for (const item of menuItems) {
      if (keys !== '*' && !keys.includes(item.key)) continue;
      await db.rolePermission.upsert({
        where: { roleId_menuItemId: { roleId, menuItemId: item.id } },
        update: perms,
        create: { roleId, menuItemId: item.id, ...perms },
      });
    }
  };
  const FULL = { canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true };
  await grant(superadmin.id, '*', FULL);
  await grant(manager.id, ['dashboard', 'pos', 'bookings', 'devotees', 'reports', 'lookups'], { ...FULL, canDelete: false });
  await grant(staff.id, ['dashboard', 'pos', 'devotees'], { canView: true, canCreate: true, canEdit: false, canDelete: false, canExport: false });

  // ---- Superadmin user ----
  await db.user.upsert({
    where: { email: 'admin@tmadj.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@tmadj.com',
      passwordHash: await bcrypt.hash('Admin@123', 12),
      roleId: superadmin.id,
    },
  });

  // ---- Lookup types ----
  const typeByCode = {};
  for (const t of LOOKUP_TYPES) {
    typeByCode[t.code] = await db.lookupType.upsert({ where: { code: t.code }, update: {}, create: t });
  }

  const addValue = async (code, nameEn, extra = {}) => {
    const typeId = typeByCode[code].id;
    const existing = await db.lookupValue.findFirst({ where: { typeId, nameEn, parentId: extra.parentId ?? null } });
    if (existing) return existing;
    return db.lookupValue.create({ data: { typeId, nameEn, ...extra } });
  };

  // Archanai / Ubhayam (from client doc)
  await addValue('ARCHANAI', 'Archanai', { nameTa: 'அர்ச்சனை', price: 5, sortOrder: 1 });
  await addValue('ARCHANAI', 'Kanda Shasti Ubhayam', { price: 51, sortOrder: 2 });
  await addValue('ARCHANAI', 'Navarathiri Ubhayam', { price: 101, sortOrder: 3 });
  await addValue('ARCHANAI', 'Abishegam', { price: 151, sortOrder: 4 });

  // Donations: Main -> Sub categories
  const building = await addValue('DONATION', 'Temple Building Fund', { sortOrder: 1 });
  await addValue('DONATION', 'Gopuram Renovation', { parentId: building.id, sortOrder: 1 });
  await addValue('DONATION', 'Hall Extension', { parentId: building.id, sortOrder: 2 });
  const general = await addValue('DONATION', 'General Donation', { sortOrder: 2 });
  await addValue('DONATION', 'Undi Donation', { parentId: general.id, sortOrder: 1 });
  await addValue('DONATION', 'Special Pooja Sponsorship', { parentId: general.id, sortOrder: 2 });

  // Hall events (RM rates from client doc) - own table, managed in Temple Config
  const HALL_EVENTS = [
    ['Wedding', 1000], ['Engagement', 5000], ['Bangle Ceremony', 800], ['Baby Shower', 800], ['Temple Archanai Wedding', 1500],
  ];
  if (!(await db.eventType.count())) {
    await db.eventType.createMany({ data: HALL_EVENTS.map(([nameEn, price], i) => ({ nameEn, price, depositPct: 50, sortOrder: i + 1 })) });
  }

  // Annadhanam
  await addValue('ANNADHANAM', 'Ponggal', { price: 30, sortOrder: 1 });
  await addValue('ANNADHANAM', 'Puli Soru', { price: 30, sortOrder: 2 });
  await addValue('ANNADHANAM', 'Kacang', { price: 20, sortOrder: 3 });

  // POS payment modes
  await addValue('PAYMENT_MODE', 'Cash', { sortOrder: 1, meta: { code: 'CASH' } });
  await addValue('PAYMENT_MODE', 'DuitNow QR', { sortOrder: 2, meta: { code: 'DUITNOW_QR' } });

  // Booking payment modes (separate from POS)
  await addValue('BOOKING_PAYMENT_MODE', 'Cash', { sortOrder: 1, meta: { code: 'CASH' } });
  await addValue('BOOKING_PAYMENT_MODE', 'Online Transfer', { sortOrder: 2, meta: { code: 'ONLINE_TRANSFER' } });
  await addValue('BOOKING_PAYMENT_MODE', 'Cheque', { sortOrder: 3, meta: { code: 'CHEQUE' } });
  await addValue('BOOKING_PAYMENT_MODE', 'DuitNow QR', { sortOrder: 4, meta: { code: 'DUITNOW_QR' } });

  // Natchathiram (27 stars)
  const stars = ['Aswini','Bharani','Karthigai','Rohini','Mirugasirisham','Thiruvathirai','Punarpoosam','Poosam','Ayilyam','Magam','Pooram','Uthiram','Hastham','Chithirai','Swathi','Visakam','Anusham','Kettai','Moolam','Pooradam','Uthiradam','Thiruvonam','Avittam','Sathayam','Poorattathi','Uthirattathi','Revathi'];
  for (let i = 0; i < stars.length; i++) await addValue('NATCHATHIRAM', stars[i], { sortOrder: i + 1 });

  // Membership Types (price = fee, meta.months = duration)
  await addValue('MEMBERSHIP_TYPE', 'Annual',   { price: 50, sortOrder: 1, meta: { months: 12 } });
  await addValue('MEMBERSHIP_TYPE', 'Biannual', { price: 30, sortOrder: 2, meta: { months: 6 } });
  await addValue('MEMBERSHIP_TYPE', 'Monthly',  { price: 10, sortOrder: 3, meta: { months: 1 } });

  // ---- Default settings ----
  const settings = {
    'temple.name': 'TMADJ Temple',
    'temple.nameTa': '',
    'temple.address': '',
    'temple.phone': '',
    'temple.logoUrl': '',
    'qr.imageUrl': '',
    'receipt.paperWidth': '80',
    'receipt.footerText': 'Om Sakthi · Thank you for your devotion',
    'receipt.language': 'EN',
    'reminder.leadDays': 7,
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  console.log('Seed complete. Login: admin@tmadj.com / Admin@123');
}

main().finally(() => db.$disconnect());
