#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif

#ifndef SourceBinary
  #define SourceBinary "dist\\bin\\windows\\tadoi.exe"
#endif

#ifndef OutputDir
  #define OutputDir "dist\\installers"
#endif

[Setup]
AppId={{8F28950E-6C75-4127-A2F3-915A23C0E6F0}
AppName=TADOI
AppVersion={#MyAppVersion}
AppPublisher=TADOI
DefaultDirName={autopf}\TADOI
DefaultGroupName=TADOI
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename=TADOI-Setup-x64-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
UninstallDisplayIcon={app}\tadoi.exe

[Files]
Source: "{#SourceBinary}"; DestDir: "{app}"; Flags: ignoreversion

[Code]
const
  EnvironmentKey = 'Environment';

function NeedsAddPath(const Dir: string): Boolean;
var
  PathValue: string;
begin
  if not RegQueryStringValue(HKCU, EnvironmentKey, 'Path', PathValue) then
  begin
    Result := True;
    Exit;
  end;

  Result := Pos(';' + Uppercase(Dir) + ';', ';' + Uppercase(PathValue) + ';') = 0;
end;

procedure AddToUserPath(const Dir: string);
var
  PathValue: string;
begin
  if not RegQueryStringValue(HKCU, EnvironmentKey, 'Path', PathValue) then
    PathValue := '';

  if NeedsAddPath(Dir) then
  begin
    if (PathValue <> '') and (PathValue[Length(PathValue)] <> ';') then
      PathValue := PathValue + ';';
    PathValue := PathValue + Dir;
    RegWriteExpandStringValue(HKCU, EnvironmentKey, 'Path', PathValue);
  end;
end;

procedure RemoveFromUserPath(const Dir: string);
var
  PathValue: string;
  Updated: string;
  StartPos: Integer;
  Token: string;
begin
  if not RegQueryStringValue(HKCU, EnvironmentKey, 'Path', PathValue) then
    Exit;

  Updated := '';
  while PathValue <> '' do
  begin
    StartPos := Pos(';', PathValue);
    if StartPos > 0 then
    begin
      Token := Copy(PathValue, 1, StartPos - 1);
      Delete(PathValue, 1, StartPos);
    end
    else
    begin
      Token := PathValue;
      PathValue := '';
    end;

    if Uppercase(Trim(Token)) <> Uppercase(Dir) then
    begin
      if Updated <> '' then
        Updated := Updated + ';';
      Updated := Updated + Token;
    end;
  end;

  RegWriteExpandStringValue(HKCU, EnvironmentKey, 'Path', Updated);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  { Keep CLI discoverable after install without requiring manual PATH edits. }
  if CurStep = ssPostInstall then
    AddToUserPath(ExpandConstant('{app}'));
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  { Remove only our install directory from user PATH during uninstall. }
  if CurUninstallStep = usUninstall then
    RemoveFromUserPath(ExpandConstant('{app}'));
end;
