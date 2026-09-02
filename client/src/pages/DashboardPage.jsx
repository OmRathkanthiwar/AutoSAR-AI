import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import {
  Shield, FileText, ClipboardCheck, Loader2, RefreshCw, Upload,
  Download, X, CheckCircle2, AlertCircle, FileJson
} from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);
  const [stats, setStats] = useState({ pending: 0, review: 0, completed: 0 });
  const [listError, setListError] = useState(null);

  // Upload state
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const result = await api.listCases();
      if (result.success && Array.isArray(result.data)) {
        const casesData = result.data;
        setCases(casesData);
        setStats({
          pending: casesData.filter(c => ['UNDER_INVESTIGATION', 'DRAFT_READY', 'NEW', 'Alert Received'].includes(c.status)).length,
          review: casesData.filter(c => c.status === 'UNDER_REVIEW' || c.status === 'Pending Review').length,
          completed: casesData.filter(c => ['APPROVED', 'REJECTED', 'CLOSED', 'COMPLETED'].includes(c.status)).length,
        });
      }
    } catch (err) {
      console.error('Failed to fetch cases:', err);
      setListError(err.message || 'Failed to fetch cases');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkDbStatus = async () => {
    try {
      const result = await api.health();
      setDbStatus(result.database === 'connected' ? 'connected' : 'error');
    } catch {
      setDbStatus('error');
    }
  };

  useEffect(() => {
    fetchCases();
    checkDbStatus();
  }, [fetchCases]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED': case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'UNDER_REVIEW': case 'Pending Review': return 'bg-amber-100 text-amber-800';
      case 'DRAFT_READY': case 'UNDER_INVESTIGATION': case 'Alert Received': return 'bg-blue-100 text-blue-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskColor = (score) => {
    if (score >= 75) return 'text-red-600';
    if (score >= 50) return 'text-orange-600';
    if (score >= 25) return 'text-yellow-600';
    return 'text-green-600';
  };

  const downloadSample = () => {
    const link = document.createElement('a');
    link.href = '/sample-customers.json';
    link.download = 'sample-customers.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (!droppedFile.name.endsWith('.json')) { setUploadError('Only JSON files are accepted'); return; }
      setFile(droppedFile);
      setUploadError(null);
    }
  };

  const handleFileInput = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.json')) { setUploadError('Only JSON files are accepted'); return; }
      setFile(selectedFile);
      setUploadError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      if (!jsonData.customers || !Array.isArray(jsonData.customers)) {
        throw new Error('JSON must contain a "customers" array');
      }
      const result = await api.uploadCustomers(jsonData);
      if (result.success) {
        alert(`✅ Processed ${result.data.processed} customers\n${result.data.sars_generated} SARs generated`);
        setFile(null);
        setShowUpload(false);
        if (result.data.first_case_id) {
          navigate(`/cases/${result.data.first_case_id}`);
        } else {
          fetchCases();
        }
      }
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-blue-700" />
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">AutoSAR AI</h1>
                <p className="text-sm text-gray-500">AML Compliance Dashboard</p>
              </div>
              {dbStatus && (
                <span className={`ml-4 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${dbStatus === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${dbStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} style={{ display: 'inline-block' }}></span>
                  MySQL {dbStatus === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={downloadSample} className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <Download className="mr-2 h-4 w-4" /> Download Sample
              </button>
              <Link to="/cases/new">
                <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  <FileText className="mr-2 h-4 w-4" /> New Case
                </button>
              </Link>
              <button onClick={() => { setShowUpload(!showUpload); setFile(null); setUploadError(null); }}
                className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-700 hover:bg-blue-800">
                <Upload className="mr-2 h-4 w-4" />
                {showUpload ? 'Hide Upload' : 'Upload Data'}
              </button>
              <button onClick={fetchCases} className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Zone */}
        {showUpload && (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileJson className="mr-2 h-5 w-5 text-blue-700" /> Upload Customer Data (JSON)
            </h2>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : uploadError ? 'border-red-300 bg-red-50' : file ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'}`}
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            >
              <input type="file" id="file-upload" accept=".json" onChange={handleFileInput} className="hidden" disabled={isUploading} />
              {!file ? (
                <>
                  <FileJson className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                    <Upload className="mr-2 h-4 w-4" /> Choose JSON File
                  </label>
                  <p className="mt-2 text-sm text-gray-500">or drag and drop · JSON files up to 10MB</p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="mx-auto h-12 w-12 text-green-600 mb-3" />
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                  <div className="mt-4 flex justify-center space-x-3">
                    <button onClick={() => { setFile(null); setUploadError(null); }} disabled={isUploading}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                      <X className="mr-2 h-4 w-4" /> Remove
                    </button>
                    <button onClick={handleUpload} disabled={isUploading}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50">
                      {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : <><Upload className="mr-2 h-4 w-4" /> Upload & Process</>}
                    </button>
                  </div>
                </>
              )}
            </div>
            {uploadError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{uploadError}</p>
              </div>
            )}
            {/* Expected format hint */}
            <details className="mt-4">
              <summary className="text-sm text-blue-600 cursor-pointer hover:underline">View expected JSON format</summary>
              <pre className="mt-2 text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto">{`{
  "customers": [
    {
      "customer_id": "CUST-IND-001",
      "full_name": "Rajesh Kumar",
      "pan": "ABCDE1234F",
      "occupation": "Software Engineer",
      "annual_income": 1200000,
      "transactions": [
        {
          "transaction_id": "TXN-001",
          "amount": 5000000,
          "currency": "INR",
          "date": "2024-03-01",
          "counterparty": "Unknown",
          "counterparty_country": "KY",
          "type": "WIRE_OUT"
        }
      ]
    }
  ]
}`}</pre>
            </details>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Pending Cases', value: stats.pending, icon: FileText, color: 'bg-blue-100', iconColor: 'text-blue-700' },
            { label: 'Under Review', value: stats.review, icon: ClipboardCheck, color: 'bg-amber-100', iconColor: 'text-amber-700' },
            { label: 'Completed', value: stats.completed, icon: Shield, color: 'bg-green-100', iconColor: 'text-green-700' },
          ].map(({ label, value, icon: Icon, color, iconColor }) => (
            <div key={label} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
                </div>
                <div className={`${color} rounded-full p-3`}>
                  <Icon className={`h-6 w-6 ${iconColor}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Cases Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Cases</h2>
          </div>

          {listError && (
            <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              {listError}
            </div>
          )}

          {loading ? (
            <div className="px-6 py-12 flex justify-center items-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-700" />
              <span className="ml-3 text-gray-600">Loading cases...</span>
            </div>
          ) : cases.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">No cases found. Upload customer data to get started.</p>
              <button onClick={() => setShowUpload(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-700 hover:bg-blue-800">
                <Upload className="mr-2 h-4 w-4" /> Upload Customer Data
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Case ID', 'Customer', 'Status', 'Risk Score', 'Date', 'Actions'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cases.map((c) => (
                    <tr key={c.case_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900">{c.case_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{c.customer_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(c.status)}`}>
                          {c.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-semibold ${getRiskColor(c.risk_score)}`}>{c.risk_score}</span>
                        <span className="text-gray-400"> / 100</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link to={`/cases/${c.case_id}`}>
                          <button className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50">
                            View Details
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
