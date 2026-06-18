import { setInterval } from 'timers';

const POLL_INTERVAL = 30000; // 30 seconds
const GENERATE_ENDPOINT = 'http://localhost:3000/api/process-queue';
const EMAIL_ENDPOINT = 'http://localhost:3000/api/process-email-queue';
const UPLOAD_ENDPOINT = 'http://localhost:3000/api/process-upload-queue';

console.log(`[Queue Worker] Starting background worker...`);
console.log(`[Queue Worker] Polling queues every ${POLL_INTERVAL / 1000} seconds.`);

async function pollEndpoint(endpoint, name) {
  try {
    const res = await fetch(endpoint);
    if (res.ok) {
      const data = await res.json();
      if (data.processed > 0) {
        console.log(`[${new Date().toLocaleTimeString()}] [${name}] Successfully processed ${data.processed} item(s).`);
      } else if (data.error) {
        console.error(`[${new Date().toLocaleTimeString()}] [${name}] Error processing item: ${data.error}`);
      }
    } else {
      console.error(`[${new Date().toLocaleTimeString()}] [${name}] HTTP Error: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] [${name}] Connection failed. Is the Next.js server running?`);
  }
}

setInterval(() => {
  pollEndpoint(GENERATE_ENDPOINT, 'Generate Queue');
  pollEndpoint(EMAIL_ENDPOINT, 'Email Queue');
  pollEndpoint(UPLOAD_ENDPOINT, 'Upload Queue');
}, POLL_INTERVAL);
