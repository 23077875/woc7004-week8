import http from 'k6/http';
import { check, sleep } from 'k6';

const TARGET = __ENV.KONG_URL || 'http://localhost:8000/orders';

export const options = {
  scenarios: {
    normal_load: {
      executor: 'constant-arrival-rate',
      rate: 50, // requests per second
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 200
    }
  }
};

function randomOrder() {
  const id = Math.floor(Math.random() * 100000);
  return {
    customerName: `customer-${id}`,
    items: [`item-${id % 5}`, `item-${(id + 1) % 5}`],
    totalAmount: (Math.random() * 50 + 10).toFixed(2)
  };
}

export default function () {
  const payload = JSON.stringify(randomOrder());
  const params = {
    headers: { 'Content-Type': 'application/json' }
  };
  const res = http.post(TARGET, payload, params);
  check(res, {
    'status is 201': (r) => r.status === 201
  });
  sleep(0.1);
}

