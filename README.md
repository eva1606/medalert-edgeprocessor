# MedAlert – Edge Processor

## Overview
MedAlert Edge Processor is an edge-side monitoring component designed to process
physiological measurements in real time, detect medical anomalies, and generate alerts.

The system emphasizes:
- Reliability in offline conditions
- Clear separation of responsibilities
- Configurable detection and alerting policies
- Lightweight, self-contained implementation

This project was developed as part of an academic course and focuses on correct
architecture, design, and behavior rather than production-scale deployment.

---

## Architecture Summary

The Edge Processor acts as an orchestrator and coordinates the following sub-modules:

- **SignalValidator** – Validates incoming measurements
- **SignalProcessor** – Maintains sliding windows and provides smoothed data
- **AnomalyDetector** – Detects threshold-based and trend-based anomalies
- **AlertManager** – Applies severity policies and debounce rules
- **OfflineCacheManager** – Ensures offline-safe operation
- **HistoryRepository (v1)** – In-memory storage for inspection and testing

The core processing flow is:
Measurement
→ Validation
→ Offline-safe caching
→ Sliding window update (raw)
→ Anomaly detection (smoothed data)
→ Alert generation & debounce
→ Delivery (online/offline)

## Key Design Decisions

### Raw vs Processed Data
- Raw measurements are preserved in storage and sliding windows.
- Noise filtering (smoothing) is applied only during analysis.
- This prevents data loss and supports re-analysis.

### Offline-First Reliability
- Measurements and alerts are cached before any processing.
- Cached events are flushed in chronological order when connectivity is restored.

### Policy-Driven Severity
- Alert severity is determined via configuration (`severityPolicy`).
- Severity logic is not hardcoded in the codebase.

### Lightweight Implementation
- No external databases
- No external services
- In-memory structures are used for v1 implementation

---

## Project Structure

## Key Design Decisions

### Raw vs Processed Data
- Raw measurements are preserved in storage and sliding windows.
- Noise filtering (smoothing) is applied only during analysis.
- This prevents data loss and supports re-analysis.

### Offline-First Reliability
- Measurements and alerts are cached before any processing.
- Cached events are flushed in chronological order when connectivity is restored.

### Policy-Driven Severity
- Alert severity is determined via configuration (`severityPolicy`).
- Severity logic is not hardcoded in the codebase.

### Lightweight Implementation
- No external databases
- No external services
- In-memory structures are used for v1 implementation

---

## Project Structure
medalert-edgeprocessor/
├── src/
│ ├── edgeProcessor.js
│ ├── modules/
│ │ ├── signalValidator.js
│ │ ├── signalProcessor.js
│ │ ├── anomalyDetector.js
│ │ ├── alertManager.js
│ │ └── offlineCacheManager.js
│ ├── models/
│ │ ├── measurement.js
│ │ ├── anomaly.js
│ │ └── alertEvent.js
│ ├── repositories/
│ │ └── HistoryRepository.js
│ ├── utils/
│ │ ├── logger.js
│ │ ├── stats.js
│ │ └── time.js
│ └── config/
│ └── thresholds.json
│
├── ui/
│ ├── index.html
│ └── dashboard.js
│
├── uiServer.js
├── package.json
└── README.md


---

## Configuration

System behavior is controlled via `src/config/thresholds.json`, including:
- Threshold values per measurement type
- Trend detection configuration
- Alert severity policy
- Debounce interval
- Sliding window size

Configuration is loaded once at startup (v1 behavior).

