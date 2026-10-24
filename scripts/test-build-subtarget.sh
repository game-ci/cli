#!/usr/bin/env bash
#
# Tests for BuildSubtarget.Resolve in the default build script
# (dist/default-build-script/Assets/Editor/UnityBuilderAction/Input/BuildSubtarget.cs).
#
# The resolver decides which subtarget a standalone build asks Unity for. When it
# handed Unity StandaloneBuildSubtarget.Default, Unity fell back to the subtarget
# persisted in the project's Library, so a Library that had once built a Server
# kept building Servers - and failed on runners without the Dedicated Server module
# ("Dedicated Server support for MacStandalone is not installed").
#
# The real UnityEditor assemblies are not available here, so the file is compiled
# against minimal stubs of the few Unity types it touches. The enum values are
# copied from Unity's C# reference source, so the integers asserted below are the
# ones Unity receives. LangVersion is pinned to 9 (Unity 2021.2+) so syntax the
# editor cannot compile fails here too.
#
# Needs the .NET SDK. No Unity, no Docker, no network.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$REPO_ROOT/dist/default-build-script/Assets/Editor/UnityBuilderAction/Input/BuildSubtarget.cs"

if ! command -v dotnet >/dev/null 2>&1; then
  echo "FAIL dotnet is not installed; it is needed to compile $SOURCE" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

SDK_MAJOR="$(dotnet --version | cut -d. -f1)"

cat >"$WORK/BuildSubtargetTests.csproj" <<EOF
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net${SDK_MAJOR}.0</TargetFramework>
    <LangVersion>9</LangVersion>
    <Nullable>disable</Nullable>
    <ImplicitUsings>disable</ImplicitUsings>
    <DefineConstants>\$(DefineConstants);UNITY_2021_2_OR_NEWER</DefineConstants>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="$SOURCE" />
  </ItemGroup>
</Project>
EOF

cat >"$WORK/UnityStubs.cs" <<'EOF'
using System.Collections.Generic;

namespace UnityEditor
{
  // Values from UnityCsReference: Editor/Mono/BuildTarget.cs, Editor/Mono/BuildPipeline/BuildTargetGroup.cs and
  // EditorUserBuildSettings.bindings.cs (StandaloneBuildSubtarget).
  public enum BuildTarget { StandaloneOSX = 2, iOS = 9, Android = 13, StandaloneWindows64 = 19, WebGL = 20, StandaloneLinux64 = 24 }
  public enum BuildTargetGroup { Unknown = 0, Standalone = 1, iOS = 4, Android = 7, WebGL = 13 }
  public enum StandaloneBuildSubtarget { Default = 0, Player = 2, Server = 1 }

  public static class BuildPipeline
  {
    public static BuildTargetGroup GetBuildTargetGroup(BuildTarget target) => target switch
    {
      BuildTarget.StandaloneOSX or BuildTarget.StandaloneWindows64 or BuildTarget.StandaloneLinux64 => BuildTargetGroup.Standalone,
      BuildTarget.iOS => BuildTargetGroup.iOS,
      BuildTarget.Android => BuildTargetGroup.Android,
      BuildTarget.WebGL => BuildTargetGroup.WebGL,
      _ => BuildTargetGroup.Unknown,
    };
  }
}

namespace UnityEngine
{
  public static class Debug
  {
    public static readonly List<string> Warnings = new List<string>();
    public static void LogWarning(object message) => Warnings.Add(message.ToString());
  }
}
EOF

cat >"$WORK/Program.cs" <<'EOF'
using System;
using System.Collections.Generic;
using UnityBuilderAction.Input;
using UnityEditor;

static class Program
{
  static int failures;

  static Dictionary<string, string> Options(string subtarget) =>
    subtarget == null
      ? new Dictionary<string, string>()
      : new Dictionary<string, string> { ["standaloneBuildSubtarget"] = subtarget };

  static void Expect(string name, BuildTarget target, string subtarget, int expected, int expectedWarnings = 0)
  {
    UnityEngine.Debug.Warnings.Clear();
    var actual = BuildSubtarget.Resolve(target, Options(subtarget));
    var warnings = UnityEngine.Debug.Warnings.Count;
    var ok = actual == expected && warnings == expectedWarnings;
    Console.WriteLine($"  {(ok ? "PASS" : "FAIL")} {name}");
    if (!ok)
    {
      Console.WriteLine($"       expected subtarget {expected} with {expectedWarnings} warning(s), got {actual} with {warnings}");
      failures++;
    }
  }

  static void ExpectRejected(string name, BuildTarget target, string subtarget)
  {
    try
    {
      var actual = BuildSubtarget.Resolve(target, Options(subtarget));
      Console.WriteLine($"  FAIL {name}");
      Console.WriteLine($"       expected an ArgumentException, got subtarget {actual}");
      failures++;
    }
    catch (ArgumentException e) when (e.Message.Contains(subtarget))
    {
      Console.WriteLine($"  PASS {name}");
    }
  }

  static int Main()
  {
    const int Default = 0, Server = 1, Player = 2;

    Expect("standalone without a subtarget builds the Player", BuildTarget.StandaloneOSX, null, Player);
    Expect("an empty subtarget builds the Player", BuildTarget.StandaloneLinux64, "", Player);
    Expect("Server is passed through", BuildTarget.StandaloneLinux64, "Server", Server);
    Expect("subtarget names are case-insensitive", BuildTarget.StandaloneWindows64, "server", Server);
    Expect("Player is passed through", BuildTarget.StandaloneOSX, "Player", Player);
    Expect("an explicit Default keeps Unity's persisted subtarget", BuildTarget.StandaloneOSX, "Default", Default);
    ExpectRejected("an unknown subtarget name is rejected", BuildTarget.StandaloneOSX, "Headless");
    ExpectRejected("an undefined subtarget number is rejected", BuildTarget.StandaloneOSX, "7");
    Expect("non-standalone targets ignore a subtarget, with a warning", BuildTarget.Android, "Server", Default, 1);
    Expect("non-standalone targets without a subtarget pass 0 silently", BuildTarget.iOS, null, Default);

    Console.WriteLine(failures == 0 ? "All BuildSubtarget tests passed." : $"{failures} BuildSubtarget test(s) failed.");
    return failures == 0 ? 0 : 1;
  }
}
EOF

echo "Compiling $SOURCE against Unity stubs (net${SDK_MAJOR}.0, C# 9)"
dotnet build "$WORK/BuildSubtargetTests.csproj" --nologo -v quiet -o "$WORK/out" >"$WORK/build.log" 2>&1 || {
  cat "$WORK/build.log"
  echo "FAIL BuildSubtarget.cs does not compile"
  exit 1
}

dotnet "$WORK/out/BuildSubtargetTests.dll"
