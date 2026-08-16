# Transparent desktop month calendar

## Goal

Turn the existing Electron calendar companion into a directly interactive,
desktop-style month calendar. It should resemble the supplied reference in
behaviour: a transparent, frameless, always-on-top surface that leaves the
desktop visible around the calendar while retaining navigation and task
creation.

## Included behaviour

- The Electron companion window uses native transparency and has a transparent
  renderer background rather than the normal application shell.
- The widget renders only the Schedule month calendar: no side navigation,
  page header, scroll-card chrome, or opaque outer background.
- Its header is a translucent drag region with previous/next, today, close,
  and existing task-creation controls. Every actionable control is explicitly
  excluded from the drag region.
- Calendar cells and compact task rows remain clickable. Empty cells open the
  existing task composer, and its task mutations continue through the main
  Super Productivity data store.
- The window stays always-on-top and resizable, and opens at a desktop-sized
  position near the top right of the current display.

## Constraints

- Reuse the hardened existing `calendarWidget=1` renderer and navigation
  guard; no new IPC bridge or storage/data model is introduced.
- Do not copy TickTick branding or assets. Use existing Super Productivity CSS
  tokens, icons, and task composer.
- The widget is not click-through: the user must be able to interact with all
  visible calendar controls.
- It does not become a wallpaper or replace Windows desktop icons; it is an
  interactive transparent Electron overlay above the desktop.

## Verification

- A focused component test proves calendar-widget styling hooks are rendered.
- Electron TypeScript build and target Angular schedule tests pass.
- A packaged local Windows install launches a frameless transparent widget and
  retains direct task-creation interaction.
