async function nextPublicId(conn, entity, prefix) {
  await conn.query('UPDATE id_sequences SET last_number = last_number + 1 WHERE entity = ?', [entity]);
  const [rows] = await conn.query('SELECT last_number FROM id_sequences WHERE entity = ?', [entity]);
  if (!rows.length) {
    throw new Error(`Missing id sequence for ${entity}`);
  }
  return `${prefix}${String(rows[0].last_number).padStart(6, '0')}`;
}

module.exports = { nextPublicId };
