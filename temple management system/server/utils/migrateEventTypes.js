import { sequelize, EventType, LookupType, LookupValue } from '../db.js';

// One-time: move the old HALL_EVENT lookup values into the eventtype table, keeping ids
// so existing hallbooking.eventTypeId values stay valid. Skipped once the lookup type is gone.
export async function migrateHallEventTypes(log = console.log) {
  const type = await LookupType.findOne({ where: { code: 'HALL_EVENT' } });
  if (!type) return;
  const values = await LookupValue.findAll({ where: { typeId: type.id }, order: [['id', 'ASC']] });
  await sequelize.transaction(async (transaction) => {
    if (!(await EventType.count({ transaction }))) {
      await EventType.bulkCreate(values.map((v) => ({
        id: v.id, nameEn: v.nameEn, nameTa: v.nameTa, price: v.price,
        depositPct: v.depositPct ?? 50, isActive: v.isActive, sortOrder: v.sortOrder,
      })), { transaction });
    }
    await LookupValue.destroy({ where: { typeId: type.id }, transaction });
    await LookupType.destroy({ where: { id: type.id }, transaction });
  });
  log('INFO', `Moved ${values.length} hall/event types from lookups to eventtype`);
}
