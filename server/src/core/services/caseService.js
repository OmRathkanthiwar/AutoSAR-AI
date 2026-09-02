import { query, execute } from '../../db/connection.js';

export class CaseService {
  /**
   * Create a new case with normalized data and rule engine output.
   */
  static async createCase(caseData, ruleOutput, riskIndicators = []) {
    const { case_id } = caseData;
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // 1. Insert base case record
    await execute(
      `INSERT INTO cases (case_id, customer_name, status, created_at, last_updated_at, rule_engine_version)
       VALUES (?, ?, 'DRAFT_READY', ?, ?, ?)`,
      [
        case_id,
        caseData.customer.full_name || caseData.customer.name,
        timestamp,
        timestamp,
        ruleOutput.rule_engine_version,
      ]
    );

    // 2. Insert normalized case data
    await execute(
      `INSERT INTO case_data_normalized
         (case_id, alert_metadata, customer_profile, transaction_summary, transaction_list, risk_indicators, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        case_id,
        JSON.stringify({
          alert_date: caseData.alert_date,
          risk_score: ruleOutput.aggregated_risk_score,
          classification: ruleOutput.final_classification,
        }),
        JSON.stringify(caseData.customer),
        JSON.stringify({
          total_amount: ruleOutput.calculated_metrics.total_transaction_value_inr || 0,
          transaction_count: ruleOutput.calculated_metrics.transaction_count || 0,
          average_amount: ruleOutput.calculated_metrics.average_transaction_value || 0,
          date_range: {
            start:
              caseData.transactions.length > 0
                ? caseData.transactions[0].date
                : new Date().toISOString(),
            end:
              caseData.transactions.length > 0
                ? caseData.transactions[caseData.transactions.length - 1].date
                : new Date().toISOString(),
          },
        }),
        JSON.stringify(caseData.transactions),
        JSON.stringify(
          riskIndicators.length > 0
            ? riskIndicators
            : ruleOutput.triggered_rules.map(rule => ({
                indicator_type: rule.includes('ML Model') ? 'AI Predictive Anomaly' : 'Rule Violation',
                severity: rule.includes('Critical') || rule.includes('ML Model')
                  ? 'CRITICAL'
                  : rule.includes('High') ? 'HIGH' : 'MEDIUM',
                description: rule,
                rule_triggered: rule,
              }))
        ),
        timestamp,
      ]
    );

    // 3. Insert rule engine outputs
    try {
      await execute(
        `INSERT INTO rule_engine_outputs
           (case_id, execution_timestamp, rule_engine_config_id, triggered_rules, calculated_metrics,
            typology_tags, aggregated_risk_score, suspicion_summary_json, final_classification)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          case_id,
          timestamp,
          ruleOutput.rule_engine_version,
          JSON.stringify(ruleOutput.triggered_rules),
          JSON.stringify(ruleOutput.calculated_metrics),
          JSON.stringify(ruleOutput.typology_tags),
          ruleOutput.aggregated_risk_score,
          JSON.stringify(ruleOutput.suspicion_summary_json),
          ruleOutput.final_classification,
        ]
      );
    } catch (err) {
      console.error(`[CaseService] Failed to insert rule output for ${case_id}:`, err.message);
    }
  }

  /**
   * Save a new SAR draft version.
   */
  static async saveSARDraft(caseId, narrative, versionNumber = 1.0, sourceEvent = 'AUTO_GENERATED') {
    const result = await execute(
      `INSERT INTO sar_drafts (case_id, version_number, narrative_text, source_event, is_final_submission)
       VALUES (?, ?, ?, ?, FALSE)`,
      [caseId, versionNumber, narrative, sourceEvent]
    );
    return result.insertId;
  }

  /**
   * Get full case data (case + normalized + rule output + latest draft + audit logs).
   */
  static async getCase(caseId) {
    const [caseRow] = await query(`SELECT * FROM cases WHERE case_id = ?`, [caseId]);
    if (!caseRow) return null;

    const [normalizedRow] = await query(
      `SELECT * FROM case_data_normalized WHERE case_id = ?`,
      [caseId]
    );

    const [ruleOutput] = await query(
      `SELECT * FROM rule_engine_outputs WHERE case_id = ?`,
      [caseId]
    );

    const [sarDraft] = await query(
      `SELECT * FROM sar_drafts WHERE case_id = ? ORDER BY version_number DESC LIMIT 1`,
      [caseId]
    );

    const auditLogs = await query(
      `SELECT * FROM audit_trail_logs WHERE case_id = ? ORDER BY timestamp DESC`,
      [caseId]
    );

    return { caseRow, normalizedRow, ruleOutput, sarDraft, auditLogs };
  }
}
