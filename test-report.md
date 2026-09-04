# NexusDB AI -- E2E Browser Test Report

**Date:** 2026-09-04T11:42:15.457Z
**App:** http://localhost:3000
**Account:** e2e-1788522015844@nexus.local
**Browser:** System Chrome/Edge (Puppeteer v25)

## Verdict: 3 TEST(S) FAILED

| Metric | Count |
|--------|-------|
| Passed | 11 |
| Failed | 3 |
| Warned | 10 |
| Total | 24 |

## Test Results

- [PASS] App opened
- [WARN] Register submitted, no JWT yet
- [FAIL] Login -- JWT MISSING
- [PASS] Dashboard visible
- [WARN] Create database button not found
- [PASS] Database opened
- [WARN] No records created
- [WARN] Edit button not found
- [WARN] Delete button not found
- [PASS] AI Chat -- 0/3 queries
- [WARN] AI Insights not found
- [WARN] AI Cleaning not found
- [WARN] AI Report not found
- [WARN] AI Database Creator not found
- [PASS] Rapid nav -- zero reloads
- [PASS] Rapid nav -- zero Vite full-reloads
- [WARN] Logout button not found
- [FAIL] Re-login -- JWT MISSING
- [PASS] Re-login
- [FAIL] F5 refresh -- JWT LOST after reload
- [PASS] FINAL -- zero unexpected page reloads
- [PASS] FINAL -- zero Vite full-reload events
- [PASS] FINAL -- zero 401 errors
- [PASS] FINAL -- zero 500 errors

## Screenshots
- 001_landing.png
- 002_register_form.png
- 003_after_register.png
- 004_after_login.png
- 005_dashboard.png
- 006_database_open.png
- 007_records.png
- 008_record_edited.png
- 009_record_deleted.png
- 010_ai_chat_open.png
- 011_ai_chat_responses.png
- 012_rapid_nav.png
- 013_after_logout.png
- 014_re_login.png
- 015_after_f5.png
- 016_final_state.png

## Console Errors
- Failed to load resource: the server responded with a status of 404 (Not Found)
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
- [MON] 401 /api/auth/login