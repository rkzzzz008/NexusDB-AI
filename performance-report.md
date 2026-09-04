# NexusDB AI - Production Performance & Latency Report

**Execution Date:** 2026-09-04T13:22:02.839Z
**Target URL:** http://localhost:3000
**Total Runtime:** 225.6s (~3.76 min)
**Total Tracked Requests:** 697
**Total AI Invocations:** 8
**Total CRUD Operations:** 315
**Average Latency Across All Endpoints:** 499.6 ms
**Slowest Endpoint:** POST /api/ai/query (57747ms)
**Peak Node RSS Memory:** 78.31 MB
**Peak Browser Heap:** 35.84 MB

## Endpoint Latency Breakdown

| Endpoint | Requests | Avg Latency | Min Latency | Max Latency | p95 Latency | Errors |
|---|---|---|---|---|---|---|
| `GET /` | 6 | 124.0ms | 7ms | 338ms | 338ms | 0 |
| `GET /src/main.tsx` | 6 | 87.0ms | 14ms | 399ms | 399ms | 0 |
| `GET /@vite/client` | 6 | 114.3ms | 15ms | 496ms | 496ms | 0 |
| `GET /node_modules/.vite/deps/react.js` | 6 | 52.7ms | 0ms | 227ms | 227ms | 0 |
| `GET /@react-refresh` | 6 | 146.3ms | 24ms | 631ms | 631ms | 0 |
| `GET /node_modules/.vite/deps/react_jsx-dev-runtime.js` | 6 | 47.0ms | 0ms | 235ms | 235ms | 0 |
| `GET /node_modules/vite/dist/client/env.mjs` | 6 | 129.2ms | 21ms | 430ms | 430ms | 0 |
| `GET /src/App.tsx` | 6 | 144.2ms | 18ms | 562ms | 562ms | 0 |
| `GET /node_modules/.vite/deps/react-dom_client.js` | 6 | 126.2ms | 0ms | 616ms | 616ms | 0 |
| `GET /node_modules/.vite/deps/chunk-2TUXWMP5.js` | 6 | 140.8ms | 0ms | 563ms | 563ms | 0 |
| `GET /node_modules/.vite/deps/chunk-Q3EUM7V3.js` | 6 | 116.2ms | 0ms | 567ms | 567ms | 0 |
| `GET /src/index.css` | 6 | 282.7ms | 22ms | 1324ms | 1324ms | 0 |
| `GET /src/context/AuthContext.tsx` | 6 | 491.8ms | 11ms | 2614ms | 2614ms | 0 |
| `GET /src/components/common/ErrorBoundary.tsx` | 6 | 546.2ms | 24ms | 2762ms | 2762ms | 0 |
| `GET /src/context/ThemeContext.tsx` | 6 | 528.7ms | 16ms | 2770ms | 2770ms | 0 |
| `GET /src/components/common/Toaster.tsx` | 6 | 583.7ms | 36ms | 2866ms | 2866ms | 0 |
| `GET /src/components/common/Header.tsx` | 6 | 587.0ms | 26ms | 2931ms | 2931ms | 0 |
| `GET /src/context/DatabaseContext.tsx` | 6 | 566.0ms | 18ms | 2972ms | 2972ms | 0 |
| `GET /src/components/database/DynamicTable.tsx` | 6 | 629.0ms | 54ms | 2999ms | 2999ms | 0 |
| `GET /src/components/dashboard/DashboardOverview.tsx` | 6 | 625.2ms | 52ms | 3027ms | 3027ms | 0 |
| `GET /src/components/database/SchemaBuilderModal.tsx` | 6 | 681.2ms | 55ms | 3044ms | 3044ms | 0 |
| `GET /src/components/database/ImportExportModal.tsx` | 6 | 695.8ms | 58ms | 3071ms | 3071ms | 0 |
| `GET /src/components/analytics/AnalyticsDashboard.tsx` | 6 | 708.3ms | 60ms | 3106ms | 3106ms | 0 |
| `GET /src/components/database/DynamicForm.tsx` | 6 | 688.8ms | 54ms | 3123ms | 3123ms | 0 |
| `GET /src/components/landing/LandingPage.tsx` | 6 | 637.2ms | 44ms | 3137ms | 3137ms | 0 |
| `GET /src/components/ai/AIAssistantModal.tsx` | 6 | 724.2ms | 78ms | 3175ms | 3175ms | 0 |
| `GET /src/components/admin/AdminPanel.tsx` | 6 | 764.8ms | 83ms | 3241ms | 3241ms | 0 |
| `GET /src/components/common/Sidebar.tsx` | 6 | 643.5ms | 43ms | 3244ms | 3244ms | 0 |
| `GET /src/components/settings/SettingsView.tsx` | 6 | 762.0ms | 81ms | 3245ms | 3245ms | 0 |
| `GET /src/components/auth/AuthModal.tsx` | 6 | 766.7ms | 80ms | 3247ms | 3247ms | 0 |
| `GET /src/components/database/AIDatabaseCreatorModal.tsx` | 6 | 791.3ms | 85ms | 3352ms | 3352ms | 0 |
| `GET /src/components/database/ShareModal.tsx` | 6 | 786.2ms | 84ms | 3355ms | 3355ms | 0 |
| `GET /src/components/auth/ResetPasswordModal.tsx` | 6 | 814.0ms | 91ms | 3400ms | 3400ms | 0 |
| `GET /src/components/database/SummaryReportModal.tsx` | 6 | 811.8ms | 89ms | 3403ms | 3403ms | 0 |
| `GET /src/components/dashboard/AIInsightsSection.tsx` | 6 | 828.3ms | 98ms | 3411ms | 3411ms | 0 |
| `GET /src/components/database/AICleaningModal.tsx` | 6 | 830.8ms | 99ms | 3422ms | 3422ms | 0 |
| `GET /src/components/activity/ActivityTimeline.tsx` | 6 | 845.7ms | 115ms | 3423ms | 3423ms | 0 |
| `GET /src/components/database/AIReportGeneratorModal.tsx` | 6 | 836.2ms | 104ms | 3425ms | 3425ms | 0 |
| `GET /node_modules/.vite/deps/chunk-OOOX4NLR.js` | 6 | 663.5ms | 0ms | 3450ms | 3450ms | 0 |
| `GET /src/components/common/NotificationDropdown.tsx` | 6 | 288.0ms | 85ms | 593ms | 593ms | 0 |
| `GET /src/lib/excelImporter.ts` | 6 | 188.3ms | 60ms | 462ms | 462ms | 0 |
| `GET /src/data/databaseTemplates.ts` | 6 | 204.0ms | 62ms | 507ms | 507ms | 0 |
| `GET /node_modules/.vite/deps/motion_react.js` | 6 | 173.7ms | 0ms | 700ms | 700ms | 0 |
| `GET /node_modules/.vite/deps/xlsx.js` | 6 | 159.5ms | 0ms | 612ms | 612ms | 0 |
| `GET /node_modules/.vite/deps/lucide-react.js` | 6 | 707.8ms | 0ms | 3620ms | 3620ms | 0 |
| `GET /node_modules/.vite/deps/chunk-G6XK6EHU.js` | 6 | 22.7ms | 0ms | 83ms | 83ms | 0 |
| `GET /node_modules/.vite/deps/recharts.js` | 6 | 159.3ms | 0ms | 558ms | 558ms | 0 |
| `GET /node_modules/.vite/deps/html2canvas.js` | 6 | 69.3ms | 0ms | 253ms | 253ms | 0 |
| `GET /node_modules/.vite/deps/jspdf.js` | 6 | 79.8ms | 0ms | 273ms | 273ms | 0 |
| `GET /node_modules/.vite/deps/chunk-D7ZASVPN.js` | 6 | 7.2ms | 0ms | 35ms | 35ms | 0 |
| `GET /favicon.ico` | 2 | 340.5ms | 291ms | 390ms | 390ms | 2 |
| `GET /photo-1494790108377-be9c29b29330` | 6 | 4294.7ms | 1ms | 22096ms | 22096ms | 0 |
| `GET /photo-1534528741775-53994a69daeb` | 6 | 4330.8ms | 0ms | 22132ms | 22132ms | 0 |
| `GET /photo-1507003211169-0a1dd7228f2d` | 4 | 6505.3ms | 0ms | 22097ms | 22097ms | 0 |
| `POST /api/auth/register` | 1 | 448.0ms | 448ms | 448ms | 448ms | 0 |
| `GET /api/admin/stats` | 14 | 129.6ms | 9ms | 471ms | 471ms | 0 |
| `GET /api/databases` | 9 | 149.0ms | 45ms | 465ms | 465ms | 0 |
| `GET /api/notifications` | 20 | 177.5ms | 4ms | 475ms | 475ms | 0 |
| `GET /api/records` | 15 | 181.7ms | 6ms | 478ms | 478ms | 0 |
| `GET /api/auth/me` | 12 | 193.4ms | 5ms | 476ms | 476ms | 2 |
| `POST /api/auth/login` | 2 | 484.5ms | 463ms | 506ms | 506ms | 0 |
| `POST /api/auth/logout` | 1 | 10.0ms | 10ms | 10ms | 10ms | 0 |
| `POST /api/databases` | 54 | 20.0ms | 14ms | 41ms | 28ms | 0 |
| `PUT /api/databases/db-1788527974498-614` | 1 | 32.0ms | 32ms | 32ms | 32ms | 0 |
| `POST /api/databases/db-1788527974471-33/share-links` | 17 | 23.8ms | 19ms | 31ms | 31ms | 0 |
| `PUT /api/databases/db-1788527974677-994` | 1 | 23.0ms | 23ms | 23ms | 23ms | 0 |
| `PUT /api/databases/db-1788527974859-808` | 1 | 28.0ms | 28ms | 28ms | 28ms | 0 |
| `PUT /api/databases/db-1788527975034-313` | 1 | 15.0ms | 15ms | 15ms | 15ms | 0 |
| `PUT /api/databases/db-1788527975195-522` | 1 | 19.0ms | 19ms | 19ms | 19ms | 0 |
| `PUT /api/databases/db-1788527975386-748` | 1 | 19.0ms | 19ms | 19ms | 19ms | 0 |
| `PUT /api/databases/db-1788527975567-144` | 1 | 22.0ms | 22ms | 22ms | 22ms | 0 |
| `PUT /api/databases/db-1788527975748-58` | 1 | 26.0ms | 26ms | 26ms | 26ms | 0 |
| `PUT /api/databases/db-1788527975938-280` | 1 | 17.0ms | 17ms | 17ms | 17ms | 0 |
| `PUT /api/databases/db-1788527976113-198` | 1 | 16.0ms | 16ms | 16ms | 16ms | 0 |
| `PUT /api/databases/db-1788527976270-829` | 1 | 15.0ms | 15ms | 15ms | 15ms | 0 |
| `PUT /api/databases/db-1788527976466-54` | 1 | 53.0ms | 53ms | 53ms | 53ms | 0 |
| `PUT /api/databases/db-1788527976724-718` | 1 | 32.0ms | 32ms | 32ms | 32ms | 0 |
| `PUT /api/databases/db-1788527977003-307` | 1 | 30.0ms | 30ms | 30ms | 30ms | 0 |
| `PUT /api/databases/db-1788527977232-221` | 1 | 24.0ms | 24ms | 24ms | 24ms | 0 |
| `PUT /api/databases/db-1788527977420-431` | 1 | 19.0ms | 19ms | 19ms | 19ms | 0 |
| `PUT /api/databases/db-1788527977609-678` | 1 | 14.0ms | 14ms | 14ms | 14ms | 0 |
| `PUT /api/databases/db-1788527977784-394` | 1 | 18.0ms | 18ms | 18ms | 18ms | 0 |
| `POST /api/records` | 150 | 35.1ms | 18ms | 131ms | 74ms | 0 |
| `PUT /api/records/rec-1788527989260-146` | 1 | 23.0ms | 23ms | 23ms | 23ms | 0 |
| `PUT /api/records/rec-1788527989195-767` | 1 | 20.0ms | 20ms | 20ms | 20ms | 0 |
| `PUT /api/records/rec-1788527989157-310` | 1 | 22.0ms | 22ms | 22ms | 22ms | 0 |
| `PUT /api/records/rec-1788527989110-973` | 1 | 24.0ms | 24ms | 24ms | 24ms | 0 |
| `PUT /api/records/rec-1788527989077-295` | 1 | 22.0ms | 22ms | 22ms | 22ms | 0 |
| `PUT /api/records/rec-1788527989007-911` | 1 | 112.0ms | 112ms | 112ms | 112ms | 0 |
| `PUT /api/records/rec-1788527988977-965` | 1 | 71.0ms | 71ms | 71ms | 71ms | 0 |
| `PUT /api/records/rec-1788527988955-51` | 1 | 55.0ms | 55ms | 55ms | 55ms | 0 |
| `PUT /api/records/rec-1788527988931-59` | 1 | 30.0ms | 30ms | 30ms | 30ms | 0 |
| `PUT /api/records/rec-1788527988901-371` | 1 | 25.0ms | 25ms | 25ms | 25ms | 0 |
| `PUT /api/records/rec-1788527988876-194` | 1 | 61.0ms | 61ms | 61ms | 61ms | 0 |
| `PUT /api/records/rec-1788527988846-789` | 1 | 26.0ms | 26ms | 26ms | 26ms | 0 |
| `PUT /api/records/rec-1788527988814-288` | 1 | 35.0ms | 35ms | 35ms | 35ms | 0 |
| `PUT /api/records/rec-1788527988778-190` | 1 | 35.0ms | 35ms | 35ms | 35ms | 0 |
| `PUT /api/records/rec-1788527988746-885` | 1 | 27.0ms | 27ms | 27ms | 27ms | 0 |
| `PUT /api/records/rec-1788527988697-573` | 1 | 46.0ms | 46ms | 46ms | 46ms | 0 |
| `PUT /api/records/rec-1788527988621-758` | 1 | 20.0ms | 20ms | 20ms | 20ms | 0 |
| `PUT /api/records/rec-1788527988567-717` | 1 | 32.0ms | 32ms | 32ms | 32ms | 0 |
| `PUT /api/records/rec-1788527988534-768` | 1 | 34.0ms | 34ms | 34ms | 34ms | 0 |
| `PUT /api/records/rec-1788527988493-954` | 1 | 31.0ms | 31ms | 31ms | 31ms | 0 |
| `PUT /api/records/rec-1788527988457-572` | 1 | 22.0ms | 22ms | 22ms | 22ms | 0 |
| `PUT /api/records/rec-1788527988422-159` | 1 | 39.0ms | 39ms | 39ms | 39ms | 0 |
| `PUT /api/records/rec-1788527988350-948` | 1 | 35.0ms | 35ms | 35ms | 35ms | 0 |
| `PUT /api/records/rec-1788527988287-96` | 1 | 20.0ms | 20ms | 20ms | 20ms | 0 |
| `PUT /api/records/rec-1788527988260-697` | 1 | 19.0ms | 19ms | 19ms | 19ms | 0 |
| `PUT /api/records/rec-1788527988229-109` | 1 | 14.0ms | 14ms | 14ms | 14ms | 0 |
| `PUT /api/records/rec-1788527988197-32` | 1 | 19.0ms | 19ms | 19ms | 19ms | 0 |
| `PUT /api/records/rec-1788527988168-845` | 1 | 18.0ms | 18ms | 18ms | 18ms | 0 |
| `PUT /api/records/rec-1788527988143-620` | 1 | 22.0ms | 22ms | 22ms | 22ms | 0 |
| `PUT /api/records/rec-1788527988118-101` | 1 | 18.0ms | 18ms | 18ms | 18ms | 0 |
| `POST /api/records/bulk-archive` | 2 | 30.5ms | 29ms | 32ms | 32ms | 0 |
| `DELETE /api/records/rec-1788527983773-375` | 1 | 33.0ms | 33ms | 33ms | 33ms | 0 |
| `DELETE /api/records/rec-1788527983794-746` | 1 | 26.0ms | 26ms | 26ms | 26ms | 0 |
| `DELETE /api/records/rec-1788527983821-623` | 1 | 27.0ms | 27ms | 27ms | 27ms | 0 |
| `DELETE /api/records/rec-1788527983843-395` | 1 | 39.0ms | 39ms | 39ms | 39ms | 0 |
| `DELETE /api/records/rec-1788527983867-477` | 1 | 40.0ms | 40ms | 40ms | 40ms | 0 |
| `DELETE /api/records/rec-1788527983892-798` | 1 | 29.0ms | 29ms | 29ms | 29ms | 0 |
| `DELETE /api/records/rec-1788527983916-757` | 1 | 23.0ms | 23ms | 23ms | 23ms | 0 |
| `DELETE /api/records/rec-1788527983947-365` | 1 | 39.0ms | 39ms | 39ms | 39ms | 0 |
| `DELETE /api/records/rec-1788527983976-502` | 1 | 29.0ms | 29ms | 29ms | 29ms | 0 |
| `DELETE /api/records/rec-1788527983999-848` | 1 | 20.0ms | 20ms | 20ms | 20ms | 0 |
| `DELETE /api/records/rec-1788527984024-649` | 1 | 19.0ms | 19ms | 19ms | 19ms | 0 |
| `DELETE /api/records/rec-1788527984050-27` | 1 | 19.0ms | 19ms | 19ms | 19ms | 0 |
| `DELETE /api/records/rec-1788527984075-714` | 1 | 23.0ms | 23ms | 23ms | 23ms | 0 |
| `DELETE /api/records/rec-1788527984097-785` | 1 | 30.0ms | 30ms | 30ms | 30ms | 0 |
| `DELETE /api/records/rec-1788527984122-168` | 1 | 24.0ms | 24ms | 24ms | 24ms | 0 |
| `DELETE /api/records/rec-1788527984148-52` | 1 | 26.0ms | 26ms | 26ms | 26ms | 0 |
| `DELETE /api/records/rec-1788527984179-713` | 1 | 19.0ms | 19ms | 19ms | 19ms | 0 |
| `DELETE /api/records/rec-1788527984207-45` | 1 | 21.0ms | 21ms | 21ms | 21ms | 0 |
| `DELETE /api/records/rec-1788527984230-58` | 1 | 25.0ms | 25ms | 25ms | 25ms | 0 |
| `DELETE /api/records/rec-1788527984254-525` | 1 | 18.0ms | 18ms | 18ms | 18ms | 0 |
| `POST /api/ai/query` | 4 | 15383.8ms | 12ms | 57747ms | 57747ms | 0 |
| `POST /api/ai/insights` | 1 | 17089.0ms | 17089ms | 17089ms | 17089ms | 0 |
| `POST /api/ai/clean-data` | 1 | 17.0ms | 17ms | 17ms | 17ms | 0 |
| `POST /api/ai/report` | 1 | 8051.0ms | 8051ms | 8051ms | 8051ms | 0 |
| `POST /api/ai/generate-database` | 1 | 26187.0ms | 26187ms | 26187ms | 26187ms | 0 |
| `GET /api/activity` | 2 | 100.5ms | 15ms | 186ms | 186ms | 0 |
| `GET /api/admin/users` | 2 | 88.5ms | 81ms | 96ms | 96ms | 0 |
| `GET /api/admin/logs` | 2 | 90.0ms | 82ms | 98ms | 98ms | 0 |

## Memory Utilization Over Time

| Time | Stage | Node RSS (MB) | Node Heap (MB) | Browser Heap (MB) |
|---|---|---|---|---|
| 13:18:18 | Stress Test Initialized | 74.47 | 12.89 | 9.54 |
| 13:18:28 | Phase 1 App Loaded | 68.41 | 12.99 | 25.50 |
| 13:19:35 | Phase 2 DB Stress 25 | 74.68 | 15.55 | 23.29 |
| 13:19:35 | Phase 2 DB Stress 50 | 74.71 | 15.62 | 23.48 |
| 13:19:36 | Phase 2 DB Stress 75 | 75.02 | 15.82 | 23.66 |
| 13:19:37 | Phase 2 DB Stress 100 | 74.58 | 15.81 | 23.84 |
| 13:19:56 | Phase 3 Record Stress Completed | 76.38 | 17.14 | 29.46 |
| 13:21:52 | Phase 4 AI Stress Completed | 76.54 | 17.37 | 28.98 |
| 13:21:53 | Phase 5 Nav 100 | 76.48 | 18.36 | 35.34 |
| 13:21:53 | Phase 5 Nav 200 | 76.86 | 18.29 | 35.48 |
| 13:21:54 | Phase 5 Nav 300 | 76.53 | 18.18 | 35.62 |
| 13:21:54 | Phase 5 Nav 400 | 76.77 | 18.05 | 35.73 |
| 13:21:54 | Phase 5 Nav 500 | 76.82 | 17.94 | 35.84 |
| 13:22:02 | Phase 7 Test Finished | 78.31 | 15.64 | 32.40 |

## WebSocket Traffic & HMR Metrics

- **Vite WebSocket Full-Reload Messages:** 0
- **WebSocket Connection Drops:** 0
- **WebSocket Status:** Fully stable throughout high-frequency navigation and CRUD operations.
