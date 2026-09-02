-- AutoSAR AI MySQL Schema
-- Version: 2.0.0 (Local MySQL Migration)

-- 1. Cases Table
CREATE TABLE IF NOT EXISTS cases (
  case_id VARCHAR(64) PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'Alert Received',
  alert_date DATE NULL,
  risk_level VARCHAR(32) NULL,
  ingestion_version VARCHAR(32) NOT NULL DEFAULT 'v1.0.0',
  rule_engine_version VARCHAR(32) NOT NULL DEFAULT 'v2.0.0',
  analyst_id VARCHAR(64) NULL,
  reviewer_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cases_status (status),
  INDEX idx_cases_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Case Data Normalized Table
CREATE TABLE IF NOT EXISTS case_data_normalized (
  case_id VARCHAR(64) PRIMARY KEY,
  alert_metadata JSON NULL,
  customer_profile JSON NOT NULL,
  transaction_summary JSON NULL,
  transaction_list JSON NOT NULL,
  case_context JSON NULL,
  risk_indicators JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_norm_cases FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Rule Engine Outputs Table
CREATE TABLE IF NOT EXISTS rule_engine_outputs (
  case_id VARCHAR(64) PRIMARY KEY,
  execution_timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rule_engine_config_id VARCHAR(64) NOT NULL DEFAULT 'v2.0.0',
  triggered_rules JSON NOT NULL,
  calculated_metrics JSON NOT NULL,
  typology_tags JSON NOT NULL,
  aggregated_risk_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  suspicion_summary_json JSON NOT NULL,
  final_classification VARCHAR(128) NOT NULL,
  CONSTRAINT fk_rule_cases FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. SAR Drafts Table (Versioned)
CREATE TABLE IF NOT EXISTS sar_drafts (
  draft_id INT AUTO_INCREMENT PRIMARY KEY,
  case_id VARCHAR(64) NOT NULL,
  version_number DECIMAL(5,1) NOT NULL DEFAULT 1.0,
  narrative_text LONGTEXT NOT NULL,
  source_event VARCHAR(64) NOT NULL DEFAULT 'AUTO_GENERATED',
  created_by_user_id VARCHAR(64) NULL,
  is_final_submission BOOLEAN NOT NULL DEFAULT FALSE,
  prompt_log_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_case_version (case_id, version_number),
  INDEX idx_sar_drafts_case (case_id, version_number DESC),
  CONSTRAINT fk_drafts_cases FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. LLM Interaction Logs Table
CREATE TABLE IF NOT EXISTS llm_interaction_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  case_id VARCHAR(64) NOT NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  model_version VARCHAR(64) NOT NULL,
  prompt_template_version VARCHAR(64) NOT NULL,
  structured_input_json JSON NOT NULL,
  rendered_prompt LONGTEXT NOT NULL,
  raw_response JSON NOT NULL,
  post_processing_notes TEXT NULL,
  INDEX idx_llm_case (case_id, timestamp DESC),
  CONSTRAINT fk_llm_cases FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Audit Trail Logs Table (Immutable)
CREATE TABLE IF NOT EXISTS audit_trail_logs (
  audit_log_id INT AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(64) NULL,
  case_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  description TEXT NOT NULL,
  detail_payload JSON NULL,
  is_immutable BOOLEAN NOT NULL DEFAULT TRUE,
  INDEX idx_audit_case (case_id, timestamp DESC),
  INDEX idx_audit_event (event_type),
  CONSTRAINT fk_audit_cases FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
