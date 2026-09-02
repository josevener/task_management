/**
 * SSE Manager
 * 
 * Manages Server-Sent Events connections for real-time notifications.
 */

const clients = new Map(); // Map of userId -> array of response objects

/**
 * Add a new client connection for a user
 */
function addClient(userId, res) {
  if (!clients.has(userId)) {
    clients.set(userId, []);
  }
  clients.get(userId).push(res);
}

/**
 * Remove a client connection
 */
function removeClient(userId, res) {
  if (clients.has(userId)) {
    const userClients = clients.get(userId);
    const index = userClients.indexOf(res);
    if (index !== -1) {
      userClients.splice(index, 1);
    }
    if (userClients.length === 0) {
      clients.delete(userId);
    }
  }
}

/**
 * Broadcast an event to all connected clients for a specific user
 * 
 * @param {number|string} userId - The user ID to send the event to
 * @param {string} eventType - The type of event (e.g., 'notification_assignment')
 * @param {object} payload - The event data payload
 */
function broadcastToUser(userId, eventType, payload) {
  const userClients = clients.get(Number(userId));
  if (userClients && userClients.length > 0) {
    const dataString = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
    userClients.forEach(client => {
      client.write(dataString);
    });
  }
}

/**
 * Keep connections alive by sending a ping periodically
 */
const heartbeat = setInterval(() => {
  const dataString = `event: ping\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`;
  for (const userClients of clients.values()) {
    userClients.forEach(client => {
      client.write(dataString);
    });
  }
}, 30000); // 30 seconds

// The timer is a server background concern and must not keep one-shot scripts or tests alive.
heartbeat.unref();

module.exports = {
  addClient,
  removeClient,
  broadcastToUser,
};
