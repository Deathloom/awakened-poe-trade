; Deathloom fork: Path of Building is no longer inside the install folder.
; Loot Goblin keeps it in %LOCALAPPDATA%\Loot Goblin\PathOfBuilding (downloaded on
; first run, then it updates itself).

; Updating from a version that had it in resources\PathOfBuilding: move that copy
; to the new folder before the old version is removed, so only changed files
; download. Runs in .onInit after INSTDIR is read from the registry; if anything
; doesn't fit (no old copy, target already there) nothing happens and Loot Goblin
; downloads PoB instead.
!macro customInit
  Push $R0
  ReadEnvStr $R0 LOCALAPPDATA
  ${If} $R0 != ""
  ${AndIf} ${FileExists} "$INSTDIR\resources\PathOfBuilding\src\ImpactServer.lua"
  ${AndIfNot} ${FileExists} "$R0\Loot Goblin\PathOfBuilding\*.*"
    CreateDirectory "$R0\Loot Goblin"
    ClearErrors
    Rename "$INSTDIR\resources\PathOfBuilding" "$R0\Loot Goblin\PathOfBuilding"
    ClearErrors
  ${EndIf}
  Pop $R0
!macroend

; Real uninstall (not an update): remove Loot Goblin's PoB too. Settings and
; builds in Documents\Loot Goblin stay. Only touches the folder if it's ours
; (bundled.cfg in src).
!macro customUnInstall
  ${ifNot} ${isUpdated}
    Push $R0
    ReadEnvStr $R0 LOCALAPPDATA
    ${If} $R0 != ""
    ${AndIf} ${FileExists} "$R0\Loot Goblin\PathOfBuilding\src\bundled.cfg"
      RMDir /r "$R0\Loot Goblin\PathOfBuilding"
      RMDir "$R0\Loot Goblin"
    ${EndIf}
    Pop $R0
  ${endIf}
!macroend
