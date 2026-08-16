# TickTick-Style Month Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the month-cell placeholder with a full task composer and add an interactive Electron month-calendar widget.

**Architecture:** A standalone Angular composer owns title, date and optional time. `ScheduleMonthComponent` only selects the day and anchors the composer. A separate Electron window loads a restricted Angular month-widget route; settings and renderer refreshes use narrow context-isolated IPC.

**Tech Stack:** Angular standalone components, NgRx, TaskService, Angular CDK, Electron BrowserWindow, Jasmine/Karma.

## Global Constraints

- Do not modify the existing current-task widget.
- Do not copy TickTick assets, source code, or trademarked visuals.
- The no-time path dispatches `PlannerActions.planTaskForDay` with the clicked `YYYY-MM-DD`.
- The timed path calls `TaskService.addAndSchedule` with the selected local date and time.
- Each production behavior is introduced only after its failing test is observed.

---

### Task 1: Full month task composer

**Files:**

- Create: `src/app/features/schedule/schedule-task-composer/schedule-task-composer.component.ts`
- Create: `src/app/features/schedule/schedule-task-composer/schedule-task-composer.component.html`
- Create: `src/app/features/schedule/schedule-task-composer/schedule-task-composer.component.scss`
- Create: `src/app/features/schedule/schedule-task-composer/schedule-task-composer.component.spec.ts`
- Modify: `src/app/features/schedule/schedule-month/schedule-month.component.ts`
- Modify: `src/app/features/schedule/schedule-month/schedule-month.component.html`
- Modify: `src/app/features/schedule/schedule-month/schedule-month.component.scss`
- Test: `src/app/features/schedule/schedule-month/schedule-month.component.spec.ts`

**Interfaces:**

- Produces `ScheduleTaskComposerComponent` with `day = input.required<string>()`, `anchorRect = input<DOMRect | null>(null)`, and `closed = output<void>()`.
- Produces `selectedTime = signal<string | null>(null)`, `isDatePanelOpen = signal(false)`, and `submit(): Promise<void>`.

- [ ] **Step 1: Write the failing date-only task test**

```ts
it('plans a new title for the clicked day', async () => {
  fixture.componentRef.setInput('day', '2026-08-16');
  component.title.set('Prepare report');
  await component.submit();
  expect(store.dispatch).toHaveBeenCalledWith(
    PlannerActions.planTaskForDay({ task: jasmine.any(Object), day: '2026-08-16' }),
  );
});
```

- [ ] **Step 2: Run the test and observe the missing-component failure**

Run: `npx ng test --watch=false --include=src/app/features/schedule/schedule-task-composer/schedule-task-composer.component.spec.ts`

Expected: failure because `ScheduleTaskComposerComponent` has not been created.

- [ ] **Step 3: Implement the date-only path**

```ts
const id = this._taskService.add(title, false, { timeEstimate: 30 * 60 * 1000 });
const task = await firstValueFrom(this._taskService.getByIdOnce$(id));
this._store.dispatch(PlannerActions.planTaskForDay({ task, day: this.day() }));
this.closed.emit();
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx ng test --watch=false --include=src/app/features/schedule/schedule-task-composer/schedule-task-composer.component.spec.ts`

- [ ] **Step 5: Write the failing time-selection test**

```ts
it('schedules a new title at the selected local time', async () => {
  fixture.componentRef.setInput('day', '2026-08-16');
  component.selectedTime.set('09:30');
  component.title.set('Standup');
  await component.submit();
  expect(taskService.addAndSchedule).toHaveBeenCalledWith(
    'Standup', jasmine.any(Object), new Date('2026-08-16T09:30').getTime(), jasmine.anything(),
  );
});
```

- [ ] **Step 6: Run the test and observe the no-time implementation failure**

Run: `npx ng test --watch=false --include=src/app/features/schedule/schedule-task-composer/schedule-task-composer.component.spec.ts`

- [ ] **Step 7: Add the timed path**

```ts
this._taskService.addAndSchedule(
  title,
  { timeEstimate: 30 * 60 * 1000 },
  new Date(`${this.day()}T${this.selectedTime()}`).getTime(),
  this._defaultReminder(),
);
this.closed.emit();
```

- [ ] **Step 8: Implement the visual composer and date panel**

Use a white 500px maximum-width rounded dialog with: a date/reminder trigger, priority button, auto-focused title textarea, Inbox footer, and a compact month date picker. The picker offers month navigation, a selected-day highlight, optional `HH:mm` input, `确定`, and `清除`. On `Escape`, outside click, and empty blur it emits `closed`; enter saves only when not composing IME text.

- [ ] **Step 9: Integrate it into the month grid**

```html
@if (taskCreatorDay() === day) {
  <schedule-task-composer [day]="day" [anchorRect]="taskCreatorAnchorRect()"
    (closed)="closeTaskCreator()" />
}
```

Store the clicked cell rectangle, scope keyboard shortcuts to the cell, and leave existing task clicks untouched.

- [ ] **Step 10: Add month integration tests and run checks**

```ts
it('opens the full composer for a clicked date and closes it with Escape', () => {
  clickDay('2026-08-16');
  expect(query('schedule-task-composer')).not.toBeNull();
  dispatchEscape();
  expect(query('schedule-task-composer')).toBeNull();
});
```

Run: `npx ng test --watch=false --include=src/app/features/schedule/schedule-month/schedule-month.component.spec.ts`

Run: `npm run checkFile -- src/app/features/schedule/schedule-task-composer/schedule-task-composer.component.ts`

- [ ] **Step 11: Commit**

Run: `git add src/app/features/schedule/schedule-task-composer src/app/features/schedule/schedule-month && git commit -m "feat(schedule): add month task composer"`

### Task 2: Compact month strips

**Files:**

- Modify: `src/app/features/schedule/schedule-event/schedule-event.component.html`
- Modify: `src/app/features/schedule/schedule-event/schedule-event.component.scss`
- Modify: `src/app/features/schedule/schedule-month/schedule-month.component.scss`
- Test: `src/app/features/schedule/schedule-month/schedule-month.component.spec.ts`

- [ ] **Step 1: Write a failing strip contract test**

```ts
it('renders a timed month event with a compact strip and right aligned time', () => {
  renderTimedTask('2026-08-16', 9.5);
  expect(query('.month-schedule-event')).toHaveText('09:30');
  expect(query('.month-schedule-event')).toHaveClass('is-month-view');
});
```

- [ ] **Step 2: Run the month test and observe it fail**

Run: `npx ng test --watch=false --include=src/app/features/schedule/schedule-month/schedule-month.component.spec.ts`

- [ ] **Step 3: Implement the strip**

Keep the current list-color source but style month events as 22px pastel strips with 4px rounding, a left checkbox, truncated title, and right time. Do not hard-code TickTick colors.

- [ ] **Step 4: Verify and commit**

Run: `npx ng test --watch=false --include=src/app/features/schedule/schedule-month/schedule-month.component.spec.ts`

Run: `npm run lint:css-vars`

Run: `git add src/app/features/schedule/schedule-event src/app/features/schedule/schedule-month && git commit -m "feat(schedule): refine compact month task strips"`

### Task 3: Calendar-widget Electron lifecycle

**Files:**

- Create: `electron/calendar-widget/calendar-widget.ts`
- Create: `electron/calendar-widget/calendar-widget-preload.ts`
- Create: `electron/calendar-widget/calendar-widget-api.d.ts`
- Test: `electron/calendar-widget/calendar-widget.spec.ts`
- Modify: `electron/shared-with-frontend/ipc-events.const.ts`
- Modify: `electron/electronAPI.d.ts`
- Modify: `electron/indicator.ts`
- Modify: `src/app/features/config/global-config.model.ts`
- Modify: `src/app/features/config/task-widget-settings.service.ts`
- Modify: `src/app/features/config/form-cfgs/task-widget-form.const.ts`

**Interfaces:**

- Produces `updateCalendarWidgetEnabled(isEnabled: boolean): void` and `destroyCalendarWidget(): void`.
- Produces a preload bridge limited to `onRefresh` and `showMainWindow`.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
it('creates a visible always-on-top calendar widget when enabled', async () => {
  updateCalendarWidgetEnabled(true);
  await flushWidgetCreation();
  expect(BrowserWindow).toHaveBeenCalledWith(jasmine.objectContaining({
    alwaysOnTop: true, frame: false, minWidth: 420, minHeight: 360,
  }));
});

it('destroys the calendar widget when disabled', () => {
  updateCalendarWidgetEnabled(false);
  expect(widget.destroy).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run and observe the missing-module failure**

Run: `npm test -- --include=electron/calendar-widget/calendar-widget.spec.ts`

- [ ] **Step 3: Implement the secure window**

Follow `electron/task-widget/task-widget.ts`: persist `calendarWidgetBounds`, create a 640x520 frameless always-on-top resizable BrowserWindow, use `contextIsolation: true`, `nodeIntegration: false`, and load the packaged Angular `#/schedule-widget` route. Register only settings and refresh IPC listeners; destroy the window on disable.

- [ ] **Step 4: Add settings and IPC contract**

Add a separate local setting `calendarWidget: { isEnabled, opacity }`, a Settings toggle and opacity slider, `UPDATE_CALENDAR_WIDGET_SETTINGS`, and `window.ea.updateCalendarWidgetSettings`. Preserve every existing task-widget setting and IPC method.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --include=electron/calendar-widget/calendar-widget.spec.ts`

Run: `npm run checkFile -- electron/calendar-widget/calendar-widget.ts`

Run: `git add electron src/app/features/config && git commit -m "feat(electron): add calendar widget window"`

### Task 4: Interactive schedule-widget route

**Files:**

- Modify: `src/app/app.routes.ts`
- Create: `src/app/pages/schedule-widget-page/schedule-widget-page.component.ts`
- Create: `src/app/pages/schedule-widget-page/schedule-widget-page.component.html`
- Create: `src/app/pages/schedule-widget-page/schedule-widget-page.component.scss`
- Test: `src/app/pages/schedule-widget-page/schedule-widget-page.component.spec.ts`

**Interfaces:**

- Consumes `ScheduleMonthComponent` and `ScheduleTaskComposerComponent`.
- Produces a no-sidebar `#/schedule-widget` month screen with previous-month, today, and next-month controls.

- [ ] **Step 1: Write the failing page test**

```ts
it('renders a month and opens the composer from a widget day', () => {
  fixture.componentRef.setInput('visibleMonth', new Date(2026, 7, 1));
  clickDay('2026-08-16');
  expect(query('schedule-task-composer')).not.toBeNull();
});
```

- [ ] **Step 2: Run and observe the missing-page failure**

Run: `npx ng test --watch=false --include=src/app/pages/schedule-widget-page/schedule-widget-page.component.spec.ts`

- [ ] **Step 3: Implement the route and shared calendar**

Render the month view without the main sidebar, expose month navigation, reuse the composer, and send a refresh IPC notification after save. Ensure refresh updates both existing renderers without exposing node APIs to Angular.

- [ ] **Step 4: Verify the route, build, and local package**

Run: `npx ng test --watch=false --include=src/app/pages/schedule-widget-page/schedule-widget-page.component.spec.ts`

Run: `npx ng build --configuration production`

Run: `npx electron-builder --win --x64 --config.win.signAndEditExecutable=false`

- [ ] **Step 5: Install and manually validate**

Install the x64 package, enable the Calendar Widget setting, verify it is a separate movable/resizable always-on-top window, create a date-only and timed task, and verify both windows render compact task strips.

- [ ] **Step 6: Commit**

Run: `git add src/app/app.routes.ts src/app/pages/schedule-widget-page electron/calendar-widget && git commit -m "feat(schedule): add interactive calendar desktop widget"`
