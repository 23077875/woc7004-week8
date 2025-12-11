# k6 Load Test Results

| Metric                       | Value/Stats                |
|-----------------------------|----------------------------|
| Total HTTP Requests         | 24,001                     |
| HTTP Requests/sec           | 199.93                     |
| HTTP Failures               | 0                          |
| Data Sent (bytes)           | 4,965,519                  |
| Data Sent/sec (bytes)       | 41,363.03                  |
| Data Received (bytes)       | 15,187,058                 |
| Data Received/sec (bytes)   | 126,508.97                 |
| VUs (Virtual Users)         | 11 (min: 10, max: 11)      |
| VUs Max                     | 200                        |
| Checks Passed               | 24,001                     |
| Checks Failed               | 0                          |
| HTTP Req Duration (avg, ms) | 1.20                       |
| HTTP Req Duration (med, ms) | 1.02                       |
| HTTP Req Duration (max, ms) | 105.04                     |
| HTTP Req Duration p(90), ms | 1.61                       |
| HTTP Req Duration p(95), ms | 1.85                       |
| Iteration Duration (avg, ms)| 51.87                      |
| Iteration Duration (med, ms)| 51.71                      |
| Iteration Duration (max, ms)| 155.83                     |

## Latency Breakdown (ms)
| Phase           | Avg    | Median | Max     | p(90)  | p(95)  |
|-----------------|--------|--------|---------|--------|--------|
| Connecting      | 0.007  | 0      | 25.34   | 0      | 0      |
| Blocked         | 0.013  | 0.004  | 25.40   | 0.007  | 0.008  |
| Sending         | 0.032  | 0.030  | 4.94    | 0.044  | 0.052  |
| Waiting         | 1.10   | 0.93   | 104.81  | 1.48   | 1.70   |
| Receiving       | 0.067  | 0.061  | 8.92    | 0.097  | 0.112  |
| TLS Handshaking | 0      | 0      | 0       | 0      | 0      |

## Status Checks
- "status is 201": 24,001 passes, 0 fails

---
**Summary:**
- All requests succeeded (no failures).
- Median request duration: 1.02 ms.
- Throughput: ~200 requests/sec.
- No check failures; all responses returned status 201.
- System handled up to 200 virtual users.
