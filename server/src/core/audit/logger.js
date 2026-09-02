import { execute } from '../../db/connection.js';

export async function logAuditEvent(caseId, eventType, description, detailPayload = {}, userId = 'system') {
  try {
    await execute(
      `INSERT INTO audit_trail_logs (case_id, event_type, description, detail_payload, user_id, is_immutable)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [caseId, eventType, description, JSON.stringify(detailPayload), userId]
    );
  } catch (err) {
    console.error(`[AuditLogger] Failed to log event ${eventType} for case ${caseId}:`, err.message);
  }
}
