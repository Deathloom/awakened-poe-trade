// Deathloom fork: start Loot Goblin (in the tray) when the user signs in to Windows.
// Uses Electron's login item (HKCU\...\Run for the installed exe). Only for the
// installed app on Windows; dev runs (npm run dev) never register electron.exe.
import { app } from 'electron'

export function applyStartWithWindows (enabled: boolean) {
  if (process.platform !== 'win32' || !app.isPackaged) return
  try {
    const opts = { path: process.execPath, args: [] as string[] }
    if (app.getLoginItemSettings(opts).openAtLogin === enabled) return
    app.setLoginItemSettings({ ...opts, openAtLogin: enabled })
  } catch (e) {
    console.error('[StartWithWindows]', e)
  }
}
