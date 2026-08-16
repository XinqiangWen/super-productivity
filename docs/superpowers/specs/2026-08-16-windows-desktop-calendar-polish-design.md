# Windows Desktop Calendar Polish

## Goal

Make the calendar widget a Windows-first desktop companion matching the supplied TickTick reference: a restrained white month grid, compact pastel task strips, startup visibility, and no global always-on-top behavior.

## Scope

- Windows only: register the installed app to launch at login and open the calendar after the primary window is ready.
- Treat the widget as a normal desktop-level window: it is visible over the desktop but naturally goes behind another foreground application. It must not use Electron `alwaysOnTop` or appear on every virtual workspace/full-screen app.
- Persist validated widget bounds in the existing Electron simple store. The toolbar exposes an accessible lock-position toggle. Locking disables native resizing and renderer dragging; unlocking restores both.
- Rework the widget-only month styling around the reference: white surface, 38px header, fine neutral grid, small weekday labels, tight day numbers, and compact 20px pastel task strips.
- Keep task colours derived from the existing `--project-color`; a neutral fallback is used only when a task has no project/calendar colour.

## Non-goals

- Do not remove Linux/macOS source or modify their application behaviour.
- Do not imitate TickTick branding/assets or add cloud/calendar synchronisation.
- Do not add a separate user settings page; launch and desktop placement are the requested default Windows behaviour.

## Acceptance criteria

1. A Windows login registration is requested through Electron and the calendar opens after the main window is ready.
2. The widget is not always-on-top and is not forced across workspaces/full-screen apps.
3. Position and size survive a restart when still visible on a connected display.
4. The lock button toggles an IPC-backed window lock and has correct pressed/accessible labels.
5. Widget-only visual CSS does not affect the normal schedule page.
6. Month task event colour visibly comes from `--project-color` and remains a 20px single-line strip.
