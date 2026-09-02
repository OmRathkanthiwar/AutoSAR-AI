const BASE_URL = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.details || data.error || `API error ${res.status}`);
  }
  return data;
}

export const api = {
  // Cases
  listCases: () => request('/cases'),
  createCase: (body) => request('/cases', { method: 'POST', body: JSON.stringify(body) }),
  getCase: (caseId) => request(`/cases/${caseId}`),
  updateCase: (caseId, body) => request(`/cases/${caseId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCase: (caseId) => request(`/cases/${caseId}`, { method: 'DELETE' }),

  // Drafts
  saveDraft: (caseId, body) => request(`/cases/${caseId}/draft`, { method: 'POST', body: JSON.stringify(body) }),

  // Upload
  uploadCustomers: (body) => request('/cases/upload', { method: 'POST', body: JSON.stringify(body) }),

  // SAR
  generateSAR: (body) => request('/sar/generate', { method: 'POST', body: JSON.stringify(body) }),
  submitSAR: (body) => request('/sar/submit', { method: 'POST', body: JSON.stringify(body) }),

  // Health
  health: () => request('/health'),
};
