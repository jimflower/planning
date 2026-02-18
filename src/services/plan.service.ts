/**
 * API service for persisting plans to the local backend server.
 */
import axios from 'axios';
import type { PlanningEmail } from '@/types/planning.types';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10_000,
});

export const planApi = {
  /** Check if the API server is running */
  async isAvailable(): Promise<boolean> {
    try {
      await api.get('/health');
      return true;
    } catch {
      return false;
    }
  },

  /** Fetch all saved plans from the database */
  async getAll(): Promise<PlanningEmail[]> {
    const resp = await api.get<PlanningEmail[]>('/plans');
    return resp.data;
  },

  /** Fetch a single plan */
  async getById(id: string): Promise<PlanningEmail | null> {
    try {
      const resp = await api.get<PlanningEmail>(`/plans/${id}`);
      return resp.data;
    } catch {
      return null;
    }
  },

  /** Save (create or update) a plan */
  async save(plan: PlanningEmail): Promise<void> {
    await api.post('/plans', plan);
  },

  /** Delete a plan */
  async delete(id: string): Promise<void> {
    await api.delete(`/plans/${id}`);
  },

  /** Bulk sync plans (for initial migration from localStorage) */
  async bulkSync(plans: PlanningEmail[]): Promise<number> {
    const resp = await api.post<{ count: number }>('/plans/sync', plans);
    return resp.data.count;
  },
};
