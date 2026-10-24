#if UNITY_2021_2_OR_NEWER
using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace UnityBuilderAction.Input
{
  // Standalone targets build the Player unless -standaloneBuildSubtarget asks for something else.
  // Handing Unity StandaloneBuildSubtarget.Default instead would make it reuse the subtarget
  // persisted in the project's Library, so a Library that once built a Server keeps building
  // Servers, even on a runner without the Dedicated Server module.
  public static class BuildSubtarget
  {
    public static int Resolve(BuildTarget target, Dictionary<string, string> options)
    {
      options.TryGetValue("standaloneBuildSubtarget", out var requested);

      if (BuildPipeline.GetBuildTargetGroup(target) != BuildTargetGroup.Standalone)
      {
        if (!string.IsNullOrEmpty(requested))
        {
          Debug.LogWarning($"Ignoring standaloneBuildSubtarget \"{requested}\": it only applies to standalone targets, not {target}.");
        }

        return 0;
      }

      if (string.IsNullOrEmpty(requested))
      {
        return (int) StandaloneBuildSubtarget.Player;
      }

      if (!Enum.TryParse(requested, true, out StandaloneBuildSubtarget subtarget)
          || !Enum.IsDefined(typeof(StandaloneBuildSubtarget), subtarget))
      {
        throw new ArgumentException($"Unknown standaloneBuildSubtarget \"{requested}\"; expected Player or Server.");
      }

      return (int) subtarget;
    }
  }
}
#endif
