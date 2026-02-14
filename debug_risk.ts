
import { evaluateCase } from './src/core/rules/engine';
import { CaseData } from './src/core/types';
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./public/transaction_data.json', 'utf8'));
const customers = data.customers;

console.log('--- Debugging Risk Scores ---');

customers.forEach((c: any) => {
    const caseData: CaseData = {
        case_id: 'DEBUG',
        customer: {
            id: c.customer_id,
            name: c.full_name,
            occupation: c.occupation,
            annual_income: c.annual_income,
            expected_monthly_volume: c.expected_monthly_volume
        },
        transactions: c.transactions.map((t: any) => ({
            id: t.transaction_id,
            amount: parseFloat(t.amount),
            currency: t.currency,
            date: t.date,
            counterparty: t.counterparty,
            country: t.counterparty_country,
            type: t.type,
            description: t.description
        })),
        alert_date: new Date().toISOString()
    };

    const result = evaluateCase(caseData);
    console.log(`\nCustomer: ${c.full_name} (${c.customer_id})`);
    console.log(`Risk Score: ${result.aggregated_risk_score}`);
    console.log(`Details:`, result.triggered_rules);
});
