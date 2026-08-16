# TickTick-style Transparent Month Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both Super Productivity month-calendar surfaces resemble the supplied TickTick reference: Chinese month/weekday labels, restrained grid chrome, compact colour-coded task strips, and a Windows desktop widget whose empty calendar canvas remains genuinely transparent.

**Architecture:** Keep the existing Angular schedule data flow, task event component and Electron calendar-widget window. Only presentation and date-label formatting change. The normal month view uses a solid application surface; the `calendarWidget=1` route adds an isolated transparent visual skin through `:host-context(.is-calendar-widget)`, so it cannot affect non-widget routes. The Electron window remains `transparent: true` only on Windows/Linux and uses a transparent background colour.

**Tech Stack:** Angular standalone components and signals, SCSS, Jasmine/Karma, Electron, NSIS/electron-builder.

## Global Constraints

- Do not push, open, or update any upstream GitHub PR; all changes stay in the local fork.
- Target Windows desktop widget behaviour. Preserve the existing macOS opaque-window fallback.
- Empty widget day cells, weekday row and navigation header must have computed `background-color: rgba(0, 0, 0, 0)`; do not add a full-window white/blur/mica overlay.
- Weekday order must still follow `firstDayOfWeek`; only the label language is fixed to Chinese.
- Month title must be `YYYY年M月` in month mode. Day/week views retain existing localization behaviour.
- Do not change task creation, drag/drop, persistence, lock state, start-at-login, IPC guard, or navigation security while doing this visual work.
- Use test-first changes and run the exact targeted commands shown below before packaging.
- Do not leave a temporary `electron-builder.yaml` signing override in the repository after local packaging.

---

## File Structure

| File                                                                        | Responsibility                                                                                                 |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/app/features/schedule/schedule-month/schedule-month.component.ts`      | Generate fixed Chinese weekday strings while preserving first-day ordering.                                    |
| `src/app/features/schedule/schedule-month/schedule-month.component.spec.ts` | Prove Chinese labels, ordering, transparent widget canvas and visual tokens.                                   |
| `src/app/features/schedule/schedule/schedule.component.ts`                  | Return the Chinese month title only for month mode.                                                            |
| `src/app/features/schedule/schedule/schedule.component.spec.ts`             | Prove the Chinese title and avoid regressions in day/week localized titles.                                    |
| `src/app/features/schedule/schedule-month/schedule-month.component.scss`    | Define TickTick-like normal grid and transparent-widget override.                                              |
| `src/app/features/schedule/schedule/schedule.component.scss`                | Make the widget navigation visually minimal and transparent without affecting the main app.                    |
| `src/app/features/schedule/schedule-event/schedule-event.component.scss`    | Render compact pastel project-colour task strips for month cells; widget scope remains isolated.               |
| `src/app/features/schedule/schedule-event/schedule-event.component.spec.ts` | Prove a dark project colour still yields a readable pastel widget task strip.                                  |
| `electron/calendar-widget/calendar-widget.ts`                               | Verification-only: retain existing Windows alpha background and platform guard; do not redesign it.            |
| `electron/calendar-widget.test.cjs`                                         | Regression guard for widget creation/startup; run unchanged unless Electron behaviour is deliberately changed. |

## Visual Contract

### Normal month view

- Header title: `2026年8月`, not `August 2026`.
- Week headers: `周一, 周二, 周三, 周四, 周五, 周六, 周日` when Monday is first; Sunday-first starts `周日`.
- Canvas: regular app background, one-pixel very-light neutral dividers, no card shadows and no heavy cell borders.
- Day number: 15px regular-weight dark ink at the top-left. Today is a clean 28–30px primary-blue circle.
- Task strip: 20–22px high, 3px radius, 2px project-colour left accent, checkbox, one-line title and optional right-aligned time. It must use a pastel surface calculated from project colour, not opaque white.

### Windows desktop widget

- BrowserWindow: `transparent: true`, `backgroundColor: '#00000000'`, `frame: false`, `alwaysOnTop: false`, `skipTaskbar: true`; do not change the existing main-window IPC/security guard.
- Empty header, weekdays, day cells and scroll wrapper: fully transparent. Dividers are thin `rgba(23, 32, 48, .18)`; no white text-shadow, no backdrop blur, no full-cell surface.
- Text: no white outline, no shadow and no text-background pill. Use `color: #fff` with `mix-blend-mode: difference` for title, nav icons, weekday labels, day numbers and `+N`; that produces clean inverted ink directly against the wallpaper while leaving the canvas transparent. Do not apply this blend mode to task strips.
- Interactions: widget hover/focus uses only `rgba(23,32,48,.08)`, not a white translucent card. Today stays the primary-blue circle.
- Task strips: intentionally opaque/pastel for legibility, not transparent white; the wallpaper must be visible everywhere else.

## Task 1: Chinese labels and title

**Files:**

- Modify: `src/app/features/schedule/schedule-month/schedule-month.component.ts:122-151`
- Modify: `src/app/features/schedule/schedule-month/schedule-month.component.spec.ts:630-677`
- Modify: `src/app/features/schedule/schedule/schedule.component.ts:211-231`
- Modify: `src/app/features/schedule/schedule/schedule.component.spec.ts` near the header-title tests

**Interfaces:**

- Consumes: `firstDayOfWeek(): number`, where `0` is Sunday and `1` is Monday.
- Produces: `weekdayHeaders(): string[]` containing exactly seven Chinese labels in the configured order.
- Produces: `headerTitle(): string` that returns `YYYY年M月` iff `isMonthView()` is true.

- [ ] **Step 1: Write the failing weekday tests**

  In `schedule-month.component.spec.ts`, replace the English expectations with:

  ```ts
  it('renders Chinese labels in Sunday-first order', () => {
    fixture.componentRef.setInput('firstDayOfWeek', 0);
    fixture.detectChanges();

    expect(component.weekdayHeaders()).toEqual([
      '周日',
      '周一',
      '周二',
      '周三',
      '周四',
      '周五',
      '周六',
    ]);
  });

  it('renders Chinese labels in Monday-first order', () => {
    fixture.componentRef.setInput('firstDayOfWeek', 1);
    fixture.detectChanges();

    expect(component.weekdayHeaders()).toEqual([
      '周一',
      '周二',
      '周三',
      '周四',
      '周五',
      '周六',
      '周日',
    ]);
  });
  ```

- [ ] **Step 2: Run the focused test and observe RED**

  Run:

  ```powershell
  npx ng test --watch=false --include=src/app/features/schedule/schedule-month/schedule-month.component.spec.ts
  ```

  Expected: the old locale-driven implementation yields labels such as `So`/`Mo` under the pinned test locale, so the new Chinese assertions fail.

- [ ] **Step 3: Implement fixed Chinese weekday tokens**

  Replace locale formatter construction inside `weekdayHeaders` with this simple ordered lookup:

  ```ts
  readonly weekdayHeaders = computed(() => {
    const chineseWeekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const firstDay = this.firstDayOfWeek();

    return Array.from({ length: 7 }, (_, index) => chineseWeekdays[(firstDay + index) % 7]);
  });
  ```

  Remove imports that become unused (`safeFormatDate`, `DateTimeFormatService`, `TranslateStore`) only if no other method in this component needs them. Do not change the `firstDayOfWeek` input.

- [ ] **Step 4: Write the failing Chinese month-title test**

  In `schedule.component.spec.ts`, set the layout mode to `month`, provide days containing August 2026, and add:

  ```ts
  expect(component.headerTitle()).toBe('2026年8月');
  ```

- [ ] **Step 5: Run the schedule test and observe RED**

  Run:

  ```powershell
  npx ng test --watch=false --include=src/app/features/schedule/schedule/schedule.component.spec.ts
  ```

  Expected: the old implementation returns locale text such as `August 2026`.

- [ ] **Step 6: Implement the month-only title rule**

  In the `isMonthView()` branch of `headerTitle`, replace `safeFormatDate(...)` with:

  ```ts
  const mid = parseDbDateStr(days[Math.floor(days.length / 2)]);
  return `${mid.getFullYear()}年${mid.getMonth() + 1}月`;
  ```

  Leave day and week branches unchanged.

- [ ] **Step 7: Run both focused specs and observe GREEN**

  Run:

  ```powershell
  npx ng test --watch=false --include=src/app/features/schedule/schedule-month/schedule-month.component.spec.ts --include=src/app/features/schedule/schedule/schedule.component.spec.ts
  ```

  Expected: all selected tests pass.

- [ ] **Step 8: Commit the isolated behaviour change**

  ```powershell
  git add src/app/features/schedule/schedule-month/schedule-month.component.ts src/app/features/schedule/schedule-month/schedule-month.component.spec.ts src/app/features/schedule/schedule/schedule.component.ts src/app/features/schedule/schedule/schedule.component.spec.ts
  git commit -m "feat(schedule): use Chinese month calendar labels"
  ```

## Task 2: Refine normal month view to the TickTick-like grid

**Files:**

- Modify: `src/app/features/schedule/schedule-month/schedule-month.component.scss:293-540`
- Modify: `src/app/features/schedule/schedule-event/schedule-event.component.scss:551-632`
- Test: `src/app/features/schedule/schedule-month/schedule-month.component.spec.ts`
- Test: `src/app/features/schedule/schedule-event/schedule-event.component.spec.ts`

**Interfaces:**

- Consumes: existing `.month-grid-container`, `.weekday-header`, `.month-day-cell`, `.month-day-number`, `.month-schedule-event` DOM classes.
- Produces: normal month-grid styles independent of `.is-calendar-widget` and compact task-strip styles that still expose the existing checkbox/title/time components.

- [ ] **Step 1: Write a failing normal-grid style test**

  Add a test that mounts `ScheduleMonthComponent` outside an `.is-calendar-widget` ancestor and asserts the day-cell background is the app surface (not `transparent`) and the weekday text does not carry a widget text stroke:

  ```ts
  const cell = fixture.nativeElement.querySelector('.month-day-cell') as HTMLElement;
  const weekday = fixture.nativeElement.querySelector('.weekday-header') as HTMLElement;

  expect(getComputedStyle(cell).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(getComputedStyle(weekday).webkitTextStrokeWidth).not.toBe('0.75px');
  ```

- [ ] **Step 2: Run the focused month spec and observe RED**

  Run the Task 1 month test command. Expected: it fails if the current widget styles leak, or if the test fixture needs a concrete theme class. Add the minimum existing app-theme fixture setup rather than weakening the assertion.

- [ ] **Step 3: Implement the normal-grid visual hierarchy**

  In the dense desktop section of `schedule-month.component.scss`:

  ```scss
  .month-grid-container {
    gap: 0;
    border-top: 1px solid color-mix(in srgb, var(--separator-color) 60%, transparent);
    border-left: 1px solid color-mix(in srgb, var(--separator-color) 60%, transparent);
  }

  .weekday-header {
    color: var(--text-color-muted);
    font-weight: 400;
    letter-spacing: 0;
  }

  .month-day-cell {
    &:hover {
      background: color-mix(in srgb, var(--bg-lighter) 65%, transparent);
    }
  }

  .month-day-number {
    font-size: 15px;
    font-weight: 400;
  }
  ```

  Preserve responsive height logic and the existing `today` circle. Do not add shadows, gradients, whole-cell card backgrounds, or global `backdrop-filter`.

- [ ] **Step 4: Write a failing task-strip style test**

  In `schedule-event.component.spec.ts`, mount a normal `.month-schedule-event` with a project colour and assert it has a 22px height and a non-transparent background. Keep the existing deep-colour widget test as a separate test.

- [ ] **Step 5: Run the focused event spec and observe RED**

  Run:

  ```powershell
  npx ng test --watch=false --include=src/app/features/schedule/schedule-event/schedule-event.component.spec.ts
  ```

- [ ] **Step 6: Implement the compact normal task strip**

  Retain `:host.month-schedule-event` as the normal style. Its key values must remain:

  ```scss
  min-height: 22px;
  height: 22px;
  border-left: 2px solid var(--project-color, var(--separator-color));
  border-radius: 3px;
  background: color-mix(
    in srgb,
    var(--project-color, var(--schedule-event-bg)) 18%,
    var(--schedule-event-bg)
  );
  ```

  Keep the checkbox at 14px and title/time on a single line. Do not add a white `background: #fff` fallback.

- [ ] **Step 7: Run month and event specs and observe GREEN**

  Run the two targeted Angular specs. Expected: all selected tests pass.

- [ ] **Step 8: Commit the normal visual change**

  ```powershell
  git add src/app/features/schedule/schedule-month/schedule-month.component.scss src/app/features/schedule/schedule-month/schedule-month.component.spec.ts src/app/features/schedule/schedule-event/schedule-event.component.scss src/app/features/schedule/schedule-event/schedule-event.component.spec.ts
  git commit -m "style(schedule): refine TickTick-like month grid"
  ```

## Task 3: Apply a clean transparent desktop-widget skin

**Files:**

- Modify: `src/app/features/schedule/schedule-month/schedule-month.component.scss:293-350`
- Modify: `src/app/features/schedule/schedule/schedule.component.scss:120-170`
- Modify: `src/app/features/schedule/schedule-event/schedule-event.component.scss:634-660`
- Test: `src/app/features/schedule/schedule-month/schedule-month.component.spec.ts`
- Test: `src/app/features/schedule/schedule-event/schedule-event.component.spec.ts`
- Verify: `electron/calendar-widget/calendar-widget.ts:167-205`

**Interfaces:**

- Consumes: `.is-calendar-widget` class placed by `AppComponent` when the URL includes `calendarWidget=1`.
- Produces: a widget-only skin selected by `:host-context(.is-calendar-widget)`; generic month styles must not change as a side effect.

- [ ] **Step 1: Write failing widget transparency and clean-ink tests**

  In the component fixture, add class `is-calendar-widget` to an ancestor, then test:

  ```ts
  const cell = fixture.nativeElement.querySelector('.month-day-cell') as HTMLElement;
  const weekday = fixture.nativeElement.querySelector('.weekday-header') as HTMLElement;

  expect(getComputedStyle(cell).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(getComputedStyle(weekday).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(getComputedStyle(weekday).textShadow).toBe('none');
  expect(getComputedStyle(weekday).webkitTextStrokeWidth).toBe('0px');
  expect(getComputedStyle(weekday).mixBlendMode).toBe('difference');
  ```

- [ ] **Step 2: Run the widget-focused month spec and observe RED**

  Run the Task 1 month-spec command. Expected: the text-stroke/mix-blend assertions fail because the old white-core/dark-stroke treatment is still active.

- [ ] **Step 3: Implement the widget grid and text rules**

  Keep all widget overrides inside this selector:

  ```scss
  :host-context(.is-calendar-widget) { ... }
  ```

  Required declarations:

  ```scss
  .month-grid-container,
  .weekday-header,
  .month-day-cell {
    background: transparent;
    backdrop-filter: none;
    border-color: rgba(23, 32, 48, 0.18);
  }

  .weekday-header,
  .month-day-number,
  .month-more-events {
    color: #fff;
    mix-blend-mode: difference;
    -webkit-text-stroke: 0;
    text-shadow: none;
  }

  .month-day-cell:hover,
  .month-day-cell:focus-visible {
    background: rgba(23, 32, 48, 0.08);
  }
  ```

  Do not set any widget cell to `rgba(255,255,255,...)`, `#fff`, a gradient or `backdrop-filter: blur(...)`.

- [ ] **Step 4: Write a failing widget navigation isolation test**

  In `schedule.component.spec.ts`, render the schedule component with `calendarWidget=1` in `window.location.search`; assert the host has widget class and the navigation controls compute a transparent background. Create a second fixture without the query parameter and assert it does not carry `is-calendar-widget`.

- [ ] **Step 5: Run the focused schedule spec and observe RED**

  Run the Task 1 schedule-spec command. Expected: this fails until the selector or class wiring has the desired explicit rule.

- [ ] **Step 6: Implement the widget navigation skin**

  In `schedule.component.scss`, scope this to `:host-context(.is-calendar-widget)`:

  ```scss
  .schedule-nav-controls {
    background: transparent;
    backdrop-filter: none;
    border-color: rgba(23, 32, 48, 0.18);
  }

  .schedule-nav-controls .title,
  .schedule-nav-controls button,
  .schedule-nav-controls mat-icon {
    color: #fff;
    mix-blend-mode: difference;
    -webkit-text-stroke: 0;
    text-shadow: none;
  }
  ```

  Keep `-webkit-app-region: drag` on the header and `no-drag` on controls.

- [ ] **Step 7: Write/retain the widget task-strip readability test**

  In the existing widget event test, set `--project-color: #123456`, then assert that the computed widget background is a light pastel and title/time colours are `rgb(35, 38, 48)`. The test must query an event inside `.is-calendar-widget`, proving selector scoping actually matches.

- [ ] **Step 8: Implement the widget task-strip override**

  Retain this selector shape exactly; it is necessary because the component host, not a descendant, owns `month-schedule-event`:

  ```scss
  :host-context(.is-calendar-widget) {
    &.month-schedule-event {
      min-height: 20px;
      height: 20px;
      border-left-color: var(--project-color, #aab9dc);
      background: color-mix(in srgb, var(--project-color, #8aa5e8) 38%, #f2f5fb);
      color: #232630;
      mix-blend-mode: normal;

      .title,
      .month-time {
        color: #232630;
      }
      .month-task-check {
        border-color: #657084;
      }
    }
  }
  ```

- [ ] **Step 9: Run all three Angular schedule specs and observe GREEN**

  Run:

  ```powershell
  npx ng test --watch=false --include=src/app/features/schedule/schedule-event/schedule-event.component.spec.ts --include=src/app/features/schedule/schedule-month/schedule-month.component.spec.ts --include=src/app/features/schedule/schedule/schedule.component.spec.ts
  ```

  Expected: all selected tests pass, including both normal and widget scope assertions.

- [ ] **Step 10: Commit the widget-only skin**

  ```powershell
  git add src/app/features/schedule/schedule-month/schedule-month.component.scss src/app/features/schedule/schedule-month/schedule-month.component.spec.ts src/app/features/schedule/schedule/schedule.component.scss src/app/features/schedule/schedule/schedule.component.spec.ts src/app/features/schedule/schedule-event/schedule-event.component.scss src/app/features/schedule/schedule-event/schedule-event.component.spec.ts
  git commit -m "style(schedule): clean transparent desktop calendar"
  ```

## Task 4: Verify Electron contract and build the local Windows installer

**Files:**

- Verify only: `electron/calendar-widget/calendar-widget.ts`
- Verify only: `electron/calendar-widget.test.cjs`
- Generated local installer: `.tmp/app-builds/Super-Productivity-Setup-x64.exe`

**Interfaces:**

- Consumes: `openCalendarWidgetWhenMainWindowReady(mainWindow)` and persisted `simpleSettings.calendarWidget` bounds/lock state.
- Produces: a local Windows installer; no upstream action.

- [ ] **Step 1: Confirm the Electron window remains transparent on Windows**

  Inspect `calendar-widget.ts` and verify the constructor preserves:

  ```ts
  transparent: !IS_MAC,
  backgroundColor: IS_MAC ? '#f5f7fb' : '#00000000',
  alwaysOnTop: false,
  skipTaskbar: true,
  ```

  Do not modify Electron code unless one of those values regressed.

- [ ] **Step 2: Run the Electron widget regression suite**

  ```powershell
  node --test electron/calendar-widget.test.cjs
  ```

  Expected: four tests pass: normal desktop window/bounds, lock behaviour, login startup/fallback, and already-loaded main-window startup.

- [ ] **Step 3: Build fresh Angular assets before packaging**

  Run:

  ```powershell
  npx ng build --configuration stage
  ```

  This is mandatory: electron-builder packages `.tmp/angular-dist`; skipping this step will install stale CSS even if the TypeScript/Electron build succeeds.

- [ ] **Step 4: Build Electron and verify formatting**

  Run:

  ```powershell
  npm run electron:build
  git diff --check
  ```

  Expected: successful Electron compilation and no whitespace errors.

- [ ] **Step 5: Package locally without publishing**

  If the local environment requires disabling executable signing, add a temporary `win.signAndEditExecutable: false` only for the packaging command/configuration, run:

  ```powershell
  npx electron-builder --win nsis --x64 --publish never
  ```

  Then remove the temporary signing override and run `git diff --check` again. Do not run `git push`, `gh pr create`, or any publishing command.

- [ ] **Step 6: Install and launch the local app**

  Use exact paths; only stop processes whose `ExecutablePath` equals the installed target:

  ```powershell
  $appPath = 'C:\Users\xinqiangwen\AppData\Local\Programs\Super Productivity\Super Productivity.exe'
  $installer = 'E:\super-productivity-calendar\.tmp\app-builds\Super-Productivity-Setup-x64.exe'
  Get-CimInstance Win32_Process -Filter "Name='Super Productivity.exe'" |
    Where-Object ExecutablePath -eq $appPath |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Start-Process -FilePath $installer -ArgumentList '/S' -Wait
  Start-Process -FilePath $appPath
  ```

- [ ] **Step 7: Manual acceptance check on the actual Windows desktop**
  1. Confirm the desktop window opens at the persisted visible bounds and is not always on top of every application.
  2. Confirm wallpaper is visible in every empty month cell and through the header/weekday row.
  3. Confirm there is no white blur, wide white outline or full-cell white overlay.
  4. Confirm ordinary month view has a solid app surface and is not made transparent.
  5. Confirm both views display `周一` through `周日` (or Sunday-first equivalent), and the month title has Chinese year/month format.
  6. Create a task with a project colour; verify it appears as a compact pastel strip with readable title/time.
  7. Click the close control, reopen through the main schedule’s “打开桌面月历” action, lock/unlock it, and confirm size/position persist after relaunch.

- [ ] **Step 8: Commit only local source/test changes**

  ```powershell
  git status --short
  git add electron/calendar-widget.test.cjs
  git commit -m "test(calendar-widget): verify local desktop calendar build"
  ```

  Skip this commit if no Electron test source changed. Never add `.tmp`, installed binaries, user-data, or generated installer files to Git.

## Final Acceptance Checklist

- [ ] The normal month view title is `YYYY年M月`; no English month appears in month mode.
- [ ] Weekday labels are Chinese and follow user-configured Sunday/Monday start order.
- [ ] Normal month view looks like the reference: neutral thin grid and compact coloured task strips.
- [ ] The Windows widget canvas is truly transparent outside task strips; the wallpaper is visible without a white wash.
- [ ] No fuzzy white shadow/halo remains anywhere in the widget.
- [ ] Widget readability remains acceptable over both a dark and a light wallpaper.
- [ ] Ordinary main-window schedule styles remain unchanged by widget-only selectors.
- [ ] Task creation, task toggling, date/time editing, widget lock, bounds persistence, normal stacking and Windows login startup still work.
- [ ] Targeted Angular test suite, Electron widget suite, Electron build and `git diff --check` pass.
- [ ] The app is packaged and installed locally only; no upstream PR/push exists.
