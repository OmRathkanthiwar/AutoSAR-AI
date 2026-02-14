
export interface Transaction {
    id: string;
    amount: number;
    currency: string;
    date: string;
    counterparty: string;
    counterparty_country: string;
    type: string;
    description?: string;
}

export interface CustomerProfile {
    name: string;
    id: string;
    occupation: string;
    annual_income?: number;
    expected_monthly_volume?: number;
    // Additional fields mapped from JSON
    date_of_birth?: string;
    pan?: string;
    address?: string;
}

export interface CaseData {
    case_id: string;
    customer: CustomerProfile;
    transactions: Transaction[];
    alert_date?: string;
}

export interface RuleEngineOutput {
    case_id: string;
    execution_timestamp: string;
    rule_engine_version: string;
    triggered_rules: string[];
    calculated_metrics: Record<string, any>;
    typology_tags: string[];
    aggregated_risk_score: number;
    suspicion_summary_json: Record<string, any>;
    final_classification: string;
}
