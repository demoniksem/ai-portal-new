'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.homeEvents = void 0;
const events_1 = require("events");
class HomeEventEmitter extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.clients = new Map();
    }
    addClient(userId, res) {
        if (!this.clients.has(userId)) {
            this.clients.set(userId, []);
        }
        this.clients.get(userId).push({ userId, res });
    }
    removeClient(userId, res) {
        const userClients = this.clients.get(userId);
        if (!userClients)
            return;
        const idx = userClients.findIndex(c => c.res === res);
        if (idx !== -1)
            userClients.splice(idx, 1);
        if (userClients.length === 0)
            this.clients.delete(userId);
    }
    broadcast(userId, event, data) {
        const userClients = this.clients.get(userId);
        if (!userClients)
            return;
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const client of userClients) {
            try {
                client.res.write(payload);
            }
            catch {
                // Client disconnected — clean up
                this.removeClient(userId, client.res);
            }
        }
    }
    broadcastAll(event, data) {
        for (const userId of Array.from(this.clients.keys())) {
            this.broadcast(userId, event, data);
        }
    }
    getClientCount() {
        return Array.from(this.clients.values()).reduce((sum, arr) => sum + arr.length, 0);
    }
}
// Singleton instance
exports.homeEvents = new HomeEventEmitter();
//# sourceMappingURL=events.js.map