export const RULE_ENGINE_VERSION = 'v2.0.0';

export const HIGH_RISK_COUNTRIES = new Set([
  'KP', // North Korea
  'IR', // Iran
  'MM', // Myanmar
  'SY', // Syria
  'CU', // Cuba
  'KY', // Cayman Islands (Tax haven)
  'PA', // Panama
  'VG', // British Virgin Islands
]);

export const MEDIUM_RISK_COUNTRIES = new Set([
  'AE', // UAE
  'HK', // Hong Kong
  'SG', // Singapore
  'TR', // Turkey
  'RU', // Russia
]);

// INR Thresholds (in Rupees)
export const INR_CRITICAL_THRESHOLD = 4500000;    // ₹45 Lakhs (CTR reporting)
export const INR_STRUCTURING_UPPER = 990000;      // ₹9.9 Lakhs (near ₹10L limit)
export const INR_STRUCTURING_LOWER = 850000;      // ₹8.5 Lakhs
export const INR_PAN_THRESHOLD = 50000;           // ₹50,000 (PAN requirement)
export const INR_CASH_THRESHOLD = 1000000;        // ₹10 Lakhs

export const STRUCTURING_WINDOW_DAYS = 7;
export const STRUCTURING_COUNT_THRESHOLD = 3;

export const RISK_WEIGHTS = {
  CRITICAL_AMOUNT: 45,
  LARGE_AMOUNT: 30,
  SIGNIFICANT_AMOUNT: 15,
  STRUCTURING_PATTERN: 40,
  SMURFING_PATTERN: 35,
  HIGH_RISK_JURISDICTION: 30,
  MEDIUM_RISK_JURISDICTION: 15,
  UNEXPLAINED_WEALTH: 35,
  PROFILE_INCONSISTENCY_HIGH: 20,
  PROFILE_INCONSISTENCY_MED: 10,
  CASH_TRANSACTION: 25,
  ROUND_AMOUNT: 15,
  VELOCITY_HIGH: 20,
  VELOCITY_EXTREME: 35,
};

export const RISK_LEVELS = {
  LOW: 25,
  MEDIUM: 50,
  HIGH: 75,
  CRITICAL: 90,
};

export const TYPOLOGIES = {
  STRUCTURING: 'Structuring / Smurfing',
  HAWALA: 'Informal Value Transfer (Hawala)',
  TRADE_BASED: 'Trade-Based Money Laundering (TBML)',
  SHELL_COMPANY: 'Shell Company Activity',
  BLACK_MONEY: 'Cash Generation / Unaccounted Wealth',
  SMURFING: 'Smurfing (Sub-PAN Transactions)',
};

export const ROUND_AMOUNTS_INR = [
  500000, 1000000, 1500000, 2000000, 2500000, 5000000, 10000000
];
