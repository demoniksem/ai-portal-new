'use strict';

import { EventEmitter } from 'events';

// In-memory SSE broadcaster for real-time updates.
// For production with multiple backend instances, replace with Redis Pub/Sub
// per SPEC section 6.8 (Redis for notifications queue).

interface SSEClient {
  userId: string;
  res: import('express').Response;
}

class HomeEventEmitter extends EventEmitter {
  private clients: Map<string, SSEClient[]> = new Map();

  addClient(userId: string, res: import('express').Response): void {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    this.clients.get(userId)!.push({ userId, res });
  }

  removeClient(userId: string, res: import('express').Response): void {
    const userClients = this.clients.get(userId);
    if (!userClients) return;
    const idx = userClients.findIndex(c => c.res === res);
    if (idx !== -1) userClients.splice(idx, 1);
    if (userClients.length === 0) this.clients.delete(userId);
  }

  broadcast(userId: string, event: string, data: unknown): void {
    const userClients = this.clients.get(userId);
    if (!userClients) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of userClients) {
      try {
        client.res.write(payload);
      } catch {
        // Client disconnected — clean up
        this.removeClient(userId, client.res);
      }
    }
  }

  broadcastAll(event: string, data: unknown): void {
    for (const userId of Array.from(this.clients.keys())) {
      this.broadcast(userId, event, data);
    }
  }

  getClientCount(): number {
    return Array.from(this.clients.values()).reduce((sum, arr) => sum + arr.length, 0);
  }
}

// Singleton instance
export const homeEvents = new HomeEventEmitter();
