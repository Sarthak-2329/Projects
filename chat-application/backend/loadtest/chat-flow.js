import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom k6 metrics
const messagesSentRate = new Rate('successful_messages_rate');
const messageSendDuration = new Trend('message_send_duration_ms', true);
const wsConnectionsActive = new Counter('ws_connections_count');

export const options = {
  scenarios: {
    chat_load: {
      executor: 'constant-vus',
      vus: __ENV.VUS ? parseInt(__ENV.VUS) : 50,
      duration: __ENV.DURATION || '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'], // Less than 10% errors under high stress
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const WS_URL = __ENV.WS_URL || 'ws://127.0.0.1:3000';

export default function () {
  const vuId = (__VU - 1) % 200 + 1; // map VU to a user in pool [1..200]
  const email = `benchuser${vuId}@bench.dev`;
  const password = 'password123';

  // 1. Authenticate / Login
  const loginPayload = JSON.stringify({ email, password });
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const loginSuccess = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
  });

  if (!loginSuccess) {
    sleep(1);
    return;
  }

  // Extract JWT cookie from Set-Cookie header or cookie jar
  const setCookie = loginRes.headers['Set-Cookie'] || '';
  const jwtMatch = setCookie.match(/jwt=([^;]+)/);
  const cookieJar = http.cookieJar();
  const jarCookies = cookieJar.cookiesForURL(BASE_URL);
  const jwtToken = jwtMatch ? jwtMatch[1] : (jarCookies.jwt ? jarCookies.jwt[0] : '');

  const headers = {
    'Content-Type': 'application/json',
    Cookie: `jwt=${jwtToken}`,
  };

  // 2. Fetch Contact List
  const contactsRes = http.get(`${BASE_URL}/api/messages/contacts`, { headers });
  const contactsOk = check(contactsRes, {
    'contacts status is 200': (r) => r.status === 200,
    'contacts returned list': (r) => Array.isArray(r.json()),
  });

  let contacts = [];
  if (contactsOk) {
    try {
      contacts = contactsRes.json();
    } catch (_e) {
      contacts = [];
    }
  }

  let targetUserId = null;
  if (contactsOk && Array.isArray(contacts) && contacts.length > 0) {
    // Pick target user (e.g. next user in pool)
    const targetIdx = vuId % contacts.length;
    targetUserId = contacts[targetIdx]._id;
  }

  if (targetUserId) {
    // 3. Fetch Message History with target user
    const historyRes = http.get(`${BASE_URL}/api/messages/${targetUserId}?limit=20`, { headers });
    check(historyRes, {
      'history status is 200': (r) => r.status === 200,
    });

    // 4. Send a Chat Message
    const sendStart = new Date().getTime();
    const sendPayload = JSON.stringify({
      text: `Hello from VU ${__VU} iteration ${__ITER} at ${Date.now()}`,
    });
    const sendRes = http.post(`${BASE_URL}/api/messages/send/${targetUserId}`, sendPayload, { headers });
    const sendEnd = new Date().getTime();

    const sendSuccess = check(sendRes, {
      'message sent status is 201': (r) => r.status === 201,
      'message has ack': (r) => r.json() && r.json().ack === true,
    });

    messagesSentRate.add(sendSuccess);
    if (sendSuccess) {
      messageSendDuration.add(sendEnd - sendStart);
    }
  }

  // 5. Connect & maintain WebSocket / Socket.io session for real-time presence
  const socketUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket`;
  const wsHeaders = {
    Cookie: `jwt=${jwtToken}`,
  };

  ws.connect(socketUrl, { headers: wsHeaders }, function (socket) {
    wsConnectionsActive.add(1);

    socket.on('open', function () {
      socket.send('40'); // Engine.io MESSAGE (4) + Socket.io CONNECT (0)
    });

    socket.on('message', function (data) {
      if (data === '2') {
        socket.send('3'); // Respond to ping with pong
      }
    });

    socket.setTimeout(function () {
      socket.close();
    }, 1000);
  });

  sleep(0.5 + Math.random() * 0.5);
}
