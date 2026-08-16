# Windows Desktop Calendar Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Windows login-launched, desktop-level and position-lockable TickTick-style calendar widget.

**Architecture:** Electron owns startup registration, desktop window boundaries, persisted bounds, and lock state. The Angular schedule header renders the lock control and uses narrow IPC calls. Widget-only SCSS replaces the current translucent visual layer without touching the normal schedule route.

**Tech Stack:** Electron BrowserWindow/IPC/simple store, Angular signals/templates, SCSS, Karma, Node test runner.

## Global Constraints

- Windows behaviour is the product target; retain existing macOS/Linux source paths untouched.
- Never use `alwaysOnTop` or `setVisibleOnAllWorkspaces` for the calendar widget.
- Use the existing `--project-color` task colour contract.
- Add a failing automated test before each production behaviour change.

---

### Task 1: Persisted desktop-window lifecycle

**Files:**
- Modify: `electron/calendar-widget/calendar-widget.ts`
- Modify: `electron/shared-with-frontend/ipc-events.const.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/electronAPI.d.ts`
- Test: `electron/calendar-widget/calendar-widget.test.cjs`

- [ ] Write a failing Node test that expects a restored visible bounds object, `alwaysOnTop: false`, and a lock IPC event.
- [ ] Run `node --test electron/calendar-widget/calendar-widget.test.cjs` and observe the missing lifecycle API failure.
- [ ] Add validated bounds loading/saving, `lockCalendarWidget`, and explicit normal-window options; register the new IPC listener and preload type.
- [ ] Run the Node test and `npx tsc -p electron/tsconfig.electron.json --noEmit`.
- [ ] Commit the lifecycle change.

### Task 2: Windows launch registration and widget auto-open

**Files:**
- Modify: `electron/start-app.ts`
- Modify: `electron/calendar-widget/calendar-widget.ts`
- Test: `electron/calendar-widget/calendar-widget.test.cjs`

- [ ] Write a failing test expecting Windows login configuration and one delayed widget open after the primary app is ready.
- [ ] Run the Node test and observe the missing registration/open assertion.
- [ ] Implement the Windows-only `app.setLoginItemSettings({ openAtLogin: true })` call and idempotent auto-open hook.
- [ ] Run the Node test and Electron type check.
- [ ] Commit startup support.

### Task 3: Lock control and visual reference treatment

**Files:**
- Modify: `src/app/features/schedule/schedule/schedule.component.ts`
- Modify: `src/app/features/schedule/schedule/schedule.component.html`
- Modify: `src/app/features/schedule/schedule/schedule.component.scss`
- Modify: `src/app/features/schedule/schedule-month/schedule-month.component.scss`
- Modify: `src/app/features/schedule/schedule-event/schedule-event.component.scss`
- Test: `src/app/features/schedule/schedule/schedule.component.spec.ts`
- Test: `src/app/features/schedule/schedule-month/schedule-month.component.spec.ts`

- [ ] Write failing component tests for the lock button and widget-only compact coloured event treatment.
- [ ] Run the focused Karma suites and observe the missing control/style assertions.
- [ ] Implement an accessible lock button; restyle only `.is-calendar-widget` to the white reference grid and make event bars use the project colour as their pastel fill.
- [ ] Run focused Karma tests, `npm run lint:css-vars`, and `git diff --check`.
- [ ] Commit the UI change.

### Task 4: Build and local Windows acceptance

**Files:**
- No source files beyond Tasks 1–3.

- [ ] Build the Angular stage output and Windows NSIS installer.
- [ ] Install the local NSIS artifact over the existing local application.
- [ ] Launch it, open the desktop calendar, verify a coloured task strip, lock button, and the non-topmost normal window behaviour with a real foreground window.
- [ ] Commit any acceptance-path repair only after its focused test is red then green.
