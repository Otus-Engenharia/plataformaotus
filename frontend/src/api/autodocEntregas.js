/**
 * API Client: Autodoc Entregas
 */

import axios from 'axios';
import { API_URL } from '../api';

export const autodocEntregasApi = {
  getRecentEntregas: (params = {}) =>
    axios.get(`${API_URL}/api/autodoc-entregas/recent`, {
      params,
      withCredentials: true,
    }),

  getSummary: (params = {}) =>
    axios.get(`${API_URL}/api/autodoc-entregas/summary`, {
      params,
      withCredentials: true,
    }),

  syncAll: () =>
    axios.post(`${API_URL}/api/autodoc-entregas/sync-all`, {}, {
      withCredentials: true,
    }),

  getMappings: () =>
    axios.get(`${API_URL}/api/autodoc-entregas/mappings`, {
      withCredentials: true,
    }),

  createMapping: (mapping) =>
    axios.post(`${API_URL}/api/autodoc-entregas/mappings`, mapping, {
      withCredentials: true,
    }),

  deleteMapping: (id) =>
    axios.delete(`${API_URL}/api/autodoc-entregas/mappings/${id}`, {
      withCredentials: true,
    }),

  getSyncStatus: (batchId) =>
    axios.get(`${API_URL}/api/autodoc-entregas/sync-status`, {
      params: batchId ? { batchId } : undefined,
      withCredentials: true,
    }),

  discoverProjects: (portfolioProjectCodes = []) =>
    axios.post(`${API_URL}/api/autodoc-entregas/discover`, { portfolioProjectCodes }, {
      withCredentials: true,
    }),
};
