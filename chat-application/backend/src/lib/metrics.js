import promClient from 'prom-client';

// Create a Registry which registers the metrics
export const register = new promClient.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'chat-application',
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// Custom Prometheus Metrics
export const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Histogram of HTTP request durations in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const socketConnectionsActive = new promClient.Gauge({
  name: 'socket_connections_active',
  help: 'Number of currently active Socket.io connections on this instance',
  registers: [register],
});

export const messagesSentCounter = new promClient.Counter({
  name: 'messages_sent_total',
  help: 'Total number of messages sent through the application',
  registers: [register],
});
