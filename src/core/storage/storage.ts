import type { IStorageProvider, LocalOverrides } from '../types';

/**
 * An implementation of IStorageProvider that persists data in the browser's localStorage.
 */
export class LocalStorageProvider implements IStorageProvider {
  private STORAGE_KEY = 'ciclista_custom_nodes';

  /**
   * Helper to load the raw JSON object from localStorage.
   */
  private loadRawData(): Record<string, { delay?: number; notes?: string; turns?: Record<string, unknown> }> {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('Failed to load overrides from localStorage:', e);
      return {};
    }
  }

  /**
   * Helper to save raw JSON object to localStorage.
   */
  private saveRawData(data: Record<string, { delay?: number; notes?: string; turns?: Record<string, unknown> }>): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save overrides to localStorage:', e);
    }
  }

  async getOverrides(): Promise<LocalOverrides> {
    const raw = this.loadRawData();
    const nodeDelays = new Map<string, number>();
    const nodeNotes = new Map<string, string>();
    const nodeTurns = new Map<string, Record<string, unknown>>();

    Object.entries(raw).forEach(([nodeId, item]) => {
      if (item.delay !== undefined && item.delay !== null) {
        nodeDelays.set(nodeId, item.delay);
      }
      if (item.notes) {
        nodeNotes.set(nodeId, item.notes);
      }
      if (item.turns) {
        nodeTurns.set(nodeId, item.turns);
      }
    });

    return {
      nodeDelays,
      nodeNotes,
      nodeTurns,
    };
  }

  async saveNodeDelay(nodeId: string, delaySeconds: number): Promise<void> {
    const raw = this.loadRawData();
    if (!raw[nodeId]) {
      raw[nodeId] = {};
    }
    raw[nodeId].delay = delaySeconds;
    this.saveRawData(raw);
  }

  async saveNodeNotes(nodeId: string, notes: string): Promise<void> {
    const raw = this.loadRawData();
    if (!raw[nodeId]) {
      raw[nodeId] = {};
    }
    raw[nodeId].notes = notes;
    this.saveRawData(raw);
  }

  async clearNodeOverrides(nodeId: string): Promise<void> {
    const raw = this.loadRawData();
    if (raw[nodeId]) {
      delete raw[nodeId];
      this.saveRawData(raw);
    }
  }
}
