import { Router } from 'express';
import { generateSARNarrative } from '../core/llm/geminiService.js';
import { evaluateCase } from '../core/rules/engine.js';
import { execute, query } from '../db/connection.js';
import { logAuditEvent } from '../core/audit/logger.js';

const router = Router();

// POST /api/sar/generate
router.post('/generate', async (req, res) => {
  try {
    const { caseId, caseData } = req.body;
    if (!caseId || !caseData) {
      return res.status(400).json({ error: 'Missing required fields: caseId, caseData' });
    }

    const ruleEngineOutput = evaluateCase(caseData);
    const { narrative } = await generateSARNarrative(
      caseData.customer,
      caseData.transactions,
      ruleEngineOutput
    );

    res.json({
      success: true,
      data: {
        caseId,
        narrative,
        riskScore: ruleEngineOutput.aggregated_risk_score,
        classification: ruleEngineOutput.final_classification,
        triggeredRules: ruleEngineOutput.triggered_rules,
      },
    });
  } catch (error) {
    console.error('[POST /sar/generate]', error);
    res.status(500).json({ error: 'Failed to generate SAR narrative', details: error.message });
  }
});

// POST /api/sar/submit
router.post('/submit', async (req, res) => {
  try {
    const { caseId, narrative, sourceEvent = 'LLM_Regenerate' } = req.body;
    if (!caseId || !narrative) {
      return res.status(400).json({ error: 'Missing required fields: caseId, narrative' });
    }

    const [caseRow] = await query('SELECT case_id FROM cases WHERE case_id = ?', [caseId]);
    if (!caseRow) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const [latestDraft] = await query(
      'SELECT MAX(version_number) AS version_number FROM sar_drafts WHERE case_id = ?',
      [caseId]
    );
    const versionNumber = Number(latestDraft?.version_number || 0) + 0.1;

    await execute(
      `INSERT INTO sar_drafts (case_id, version_number, narrative_text, source_event, is_final_submission)
       VALUES (?, ?, ?, ?, TRUE)`,
      [caseId, versionNumber.toFixed(1), narrative, sourceEvent]
    );

    await execute(`UPDATE cases SET status = 'Pending Review', last_updated_at = ? WHERE case_id = ?`, [now, caseId]);

    await logAuditEvent(caseId, 'STATUS_CHANGE', 'Case submitted for review from UI', {
      new_status: 'Pending Review',
    });

    res.json({ success: true, message: 'SAR submitted for review.' });
  } catch (error) {
    console.error('[POST /sar/submit]', error);
    res.status(500).json({ error: 'Failed to submit SAR', details: error.message });
  }
});

export default router;
