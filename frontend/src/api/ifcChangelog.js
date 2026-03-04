/**
 * API Client: IFC Change Log
 */

import axios from 'axios';
import { API_URL } from '../api';

export const ifcChangelogApi = {
  scanProject: (projectCode) =>
    axios.post(`${API_URL}/api/ifc-changelog/scan/${projectCode}`, {}, {
      withCredentials: true,
    }),

  scanAll: () =>
    axios.post(`${API_URL}/api/ifc-changelog/scan-all`, {}, {
      withCredentials: true,
    }),

  getChangeLogs: (projectCode, params = {}) =>
    axios.get(`${API_URL}/api/ifc-changelog/${projectCode}`, {
      params,
      withCredentials: true,
    }),

  getRecentChanges: (params = {}) =>
    axios.get(`${API_URL}/api/ifc-changelog/recent`, {
      params,
      withCredentials: true,
    }),

  getSummary: (params = {}) =>
    axios.get(`${API_URL}/api/ifc-changelog/summary`, {
      params,
      withCredentials: true,
    }),
};
