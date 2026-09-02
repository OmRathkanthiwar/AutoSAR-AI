import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Shield, ArrowLeft, Plus, Loader2 } from 'lucide-react';

export default function NewCasePage() {
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [riskRating, setRiskRating] = useState('');
  const [occupation, setOccupation] = useState('');
  const [alertDate, setAlertDate] = useState('');
  const [expectedMonthlyVolume, setExpectedMonthlyVolume] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [transactions, setTransactions] = useState([
    { id: '1', amount: '', currency: 'INR', date: '', counterparty: '', country: 'IN', type: 'WIRE_OUT' },
  ]);

  const addRow = () =>
    setTransactions(prev => [...prev, { id: String(prev.length + 1), amount: '', currency: 'INR', date: '', counterparty: '', country: 'IN', type: 'WIRE_OUT' }]);

  const updateField = (id, field, value) =>
    setTransactions(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));

  const removeRow = (id) =>
    setTransactions(prev => prev.filter(r => r.id !== id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!customerName || !customerId) { setError('Customer name and ID are required.'); return; }

    const validTxns = transactions
      .map(t => ({ ...t, amountNum: parseFloat(t.amount) }))
      .filter(t => t.amountNum > 0 && t.date && t.country);

    if (validTxns.length === 0) { setError('Please enter at least one valid transaction.'); return; }

    setSubmitting(true);
    try {
      const json = await api.createCase({
        customer_name: customerName,
        customer_id: customerId,
        alert_date: alertDate || null,
        customer_profile: {
          full_name: customerName,
          customer_id: customerId,
          risk_rating: riskRating || 'Medium',
          occupation,
          expected_monthly_volume: expectedMonthlyVolume ? parseFloat(expectedMonthlyVolume) : undefined,
        },
        transaction_list: validTxns.map(t => ({
          transaction_id: `TXN-${t.id}`,
          amount: t.amountNum,
          currency: t.currency,
          date: t.date,
          counterparty: t.counterparty || 'Unknown',
          counterparty_country: t.country,
          type: t.type || 'Wire Transfer',
        })),
      });
      if (json.success) navigate(`/cases/${json.data.case_id}`);
    } catch (err) {
      setError(err.message || 'Failed to create case');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-gray-700';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center space-x-4">
          <Link to="/dashboard">
            <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </button>
          </Link>
          <div className="h-8 w-px bg-gray-300" />
          <div className="flex items-center space-x-3">
            <Shield className="h-6 w-6 text-blue-700" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Create New Case</h1>
              <p className="text-sm text-gray-500">Enter customer and transaction details to create a SAR case.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Customer Details */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Customer Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Customer Name *</label>
                <input type="text" className={inputCls} value={customerName} onChange={e => setCustomerName(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Customer ID *</label>
                <input type="text" className={inputCls} value={customerId} onChange={e => setCustomerId(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Risk Rating</label>
                <select className={inputCls} value={riskRating} onChange={e => setRiskRating(e.target.value)}>
                  <option value="">Select...</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Occupation</label>
                <input type="text" className={inputCls} value={occupation} onChange={e => setOccupation(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Expected Monthly Volume (₹)</label>
                <input type="number" min="0" className={inputCls} value={expectedMonthlyVolume} onChange={e => setExpectedMonthlyVolume(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Alert Date</label>
                <input type="date" className={inputCls} value={alertDate} onChange={e => setAlertDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Transactions</h2>
              <button type="button" onClick={addRow}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Plus className="mr-2 h-4 w-4" /> Add Transaction
              </button>
            </div>

            <div className="space-y-4">
              {transactions.map(t => (
                <div key={t.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-gray-100 rounded-md p-4 relative">
                  {transactions.length > 1 && (
                    <button type="button" onClick={() => removeRow(t.id)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-600 text-lg leading-none">×</button>
                  )}
                  <div>
                    <label className={labelCls}>Amount *</label>
                    <input type="number" min="0" className={inputCls} value={t.amount} onChange={e => updateField(t.id, 'amount', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Currency</label>
                    <select className={inputCls} value={t.currency} onChange={e => updateField(t.id, 'currency', e.target.value)}>
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Date *</label>
                    <input type="date" className={inputCls} value={t.date} onChange={e => updateField(t.id, 'date', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Counterparty</label>
                    <input type="text" className={inputCls} value={t.counterparty} onChange={e => updateField(t.id, 'counterparty', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Country (ISO code) *</label>
                    <input type="text" maxLength={2} placeholder="IN" className={inputCls} value={t.country} onChange={e => updateField(t.id, 'country', e.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <label className={labelCls}>Type</label>
                    <select className={inputCls} value={t.type} onChange={e => updateField(t.id, 'type', e.target.value)}>
                      {['WIRE_OUT','WIRE_IN','NEFT','RTGS','IMPS','UPI','CASH_DEPOSIT','CASH_WITHDRAWAL'].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={submitting}
              className="inline-flex items-center px-6 py-3 bg-blue-700 text-white rounded-md text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Case...</> : 'Create Case'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
