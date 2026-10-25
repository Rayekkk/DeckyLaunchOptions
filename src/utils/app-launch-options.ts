import { AppDetails } from "@decky/ui/dist/globals/steam-client/App"
import { Profile } from "../shared"

export const appLaunchOptionsUpdatedEventType = "dlo-app-launch-options-updated"

export interface DloCommandInfo {
  COMMAND: string
  SHORT_SH_COMMAND_PATH: string
  FULL_SH_COMMAND_PATH: string
}

export type AppLaunchOptionsUpdatedEvent = CustomEvent<{
  appid: number
  launchOptions: string
}>

export function appLaunchOptionsIsDloCommand(
  appLaunchOptions: string,
  info?: { COMMAND: string },
): boolean {
  if (!info) return false

  const command = appLaunchOptions.trim()
  return command === info.COMMAND
}

export function appLaunchOptionsIncludesDloCommand(
  appLaunchOptions: string,
  command: string,
): boolean {
  return appLaunchOptions.includes(command)
}

export function appLaunchOptionsIncludesSupportedDloCommand(
  appLaunchOptions: string,
  info: DloCommandInfo,
): boolean {
  return [
    info.COMMAND,
    info.SHORT_SH_COMMAND_PATH,
    info.FULL_SH_COMMAND_PATH,
  ].some(
    (command) =>
      !!command &&
      appLaunchOptionsIncludesDloCommand(appLaunchOptions, command),
  )
}

export function setAppLaunchOptions(appid: number, launchOptions: string) {
  SteamClient.Apps.SetAppLaunchOptions(appid, launchOptions)
  window.dispatchEvent(
    new CustomEvent(appLaunchOptionsUpdatedEventType, {
      detail: { appid, launchOptions },
    }),
  )
}

/**
 * Put back an app's original launch options, but only where DLO is in charge,
 * so apps opted out of auto-management (e.g. MoonDeck shortcuts) or never
 * switched to the DLO command keep whatever Steam currently has.
 */
export function restoreAppLaunchOptions(
  appid: number,
  profile: Profile,
  autoManage: { steam: boolean; nonSteam: boolean },
  info?: DloCommandInfo,
) {
  const { unregister } = SteamClient.Apps.RegisterForAppDetails(
    appid,
    (details: AppDetails) => {
      const appDetails = details as AppDetails & {
        strLaunchOptions?: string
        strShortcutExe?: unknown
      }
      const isNonSteamApp = typeof appDetails.strShortcutExe !== "undefined"
      const isAutoManaged =
        (isNonSteamApp ? autoManage.nonSteam : autoManage.steam) &&
        profile.disableAutoManageLaunchOptions !== true
      // Steam app details hold the live launch options. Shortcut details do
      // not (DLO reads shortcuts.vdf for them), so for those fall back to the
      // auto-manage settings, under which DLO re-applies its command anyway.
      const isManagedByDlo =
        !isNonSteamApp && info
          ? appLaunchOptionsIncludesSupportedDloCommand(
              appDetails.strLaunchOptions ?? "",
              info,
            )
          : isAutoManaged
      if (isManagedByDlo) {
        setAppLaunchOptions(appid, profile.originalLaunchOptions)
      }
      unregister()
    },
  )
}
