/**
 * API Client: Time Savings (Economia de Horas)
 */

import axios from 'axios';
import { API_URL } from '../api';

export const timeSavingsApi = {
  getSummary: (period = 'all', area = null) =>
    axios.get(`${API_URL}/api/time-savings/summary`, {
      params: { period, ...(area && { area }) },
      withCredentials: true,
    }),

  getEvents: (params = {}) =>
    axios.get(`${API_URL}/api/time-savings/events`, {
      params,
      withCredentials: true,
    }),

  getCatalog: (all = false) =>
    axios.get(`${API_URL}/api/time-savings/catalog`, {
      params: all ? { all: 'true' } : {},
      withCredentials: true,
    }),

  updateCatalog: (id, data) =>
    axios.put(`${API_URL}/api/time-savings/catalog/${id}`, data, {
      withCredentials: true,
    }),
};
