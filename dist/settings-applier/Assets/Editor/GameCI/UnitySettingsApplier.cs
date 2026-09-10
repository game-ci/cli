// Applies arbitrary Unity Editor, Project and Player settings from a
// declarative spec, so GameCI does not need a hardcoded option per setting.
//
// The spec arrives in the GAME_CI_UNITY_SETTINGS environment variable, one
// directive per line, and is applied by reflection. That is deliberate: it
// means any static settings API Unity exposes - today's, and any added in
// future versions - is reachable without a corresponding change here, in the
// CLI, or in any of the thin wrapper Actions.
//
//   EditorUserSettings.desiredImportWorkerCount = 4
//   EditorSettings.refreshImportMode = OutOfProcessPerQueue
//   PlayerSettings.SetIl2CppCodeGeneration(Standalone, OptimizeSize)
//   PlayerSettings.SetAdditionalIl2CppArgs("--maxcpucount=2")
//
// Two forms are supported: assignment (`Type.Member = value`) for properties
// and fields, and invocation (`Type.Method(arg, ...)`) for setter methods.
//
// This runs from [InitializeOnLoadMethod], which fires when the editor loads
// the assembly - necessarily before a -executeMethod build method in that
// same domain can run, and before the asset import that worker-count settings
// need to precede. Settings that only affect the player build are also
// re-applied from IPreprocessBuildWithReport, so they still land if a build
// method changed them in between.
//
// This file is only copied into the project when a spec is actually provided,
// so projects that do not use the feature are completely unaffected.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Reflection;
using System.Text;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace GameCI
{
    public static class UnitySettingsApplier
    {
        const string SpecVariable = "GAME_CI_UNITY_SETTINGS";
        const string StrictVariable = "GAME_CI_UNITY_SETTINGS_STRICT";

        [InitializeOnLoadMethod]
        public static void ApplyOnLoad()
        {
            Apply("editor load");
        }

        /// <summary>
        /// Entry point for `-executeMethod GameCI.UnitySettingsApplier.ApplyFromCommandLine`,
        /// for callers who would rather drive this explicitly than rely on load order.
        /// </summary>
        public static void ApplyFromCommandLine()
        {
            Apply("-executeMethod");
        }

        static void Apply(string trigger)
        {
            var spec = Environment.GetEnvironmentVariable(SpecVariable);

            if (string.IsNullOrEmpty(spec))
            {
                return;
            }

            var strict = IsTruthy(Environment.GetEnvironmentVariable(StrictVariable));
            var directives = Parse(spec);

            if (directives.Count == 0)
            {
                return;
            }

            Debug.Log(string.Format(
                "[GameCI] Applying {0} Unity setting directive(s) from {1} ({2}).",
                directives.Count, SpecVariable, trigger));

            var failures = new List<string>();

            foreach (var directive in directives)
            {
                string error;

                if (ApplyDirective(directive, out error))
                {
                    Debug.Log("[GameCI]   applied: " + directive.Source);
                }
                else
                {
                    // Reported as a warning rather than thrown, so one directive
                    // that a given Unity version does not support cannot fail an
                    // otherwise valid build. GAME_CI_UNITY_SETTINGS_STRICT=true
                    // turns these into a hard failure for pipelines that would
                    // rather not silently build with the wrong settings.
                    var message = string.Format("[GameCI]   FAILED: {0} -> {1}", directive.Source, error);
                    failures.Add(message);
                    Debug.LogWarning(message);
                }
            }

            if (strict && failures.Count > 0)
            {
                throw new BuildFailedException(string.Format(
                    "[GameCI] {0} of {1} setting directive(s) failed and {2} is set.{3}{4}",
                    failures.Count, directives.Count, StrictVariable,
                    Environment.NewLine, string.Join(Environment.NewLine, failures.ToArray())));
            }
        }

        // --- Parsing -------------------------------------------------------

        internal sealed class Directive
        {
            public string Source;
            public string TypeName;
            public string MemberName;
            public string Value;        // assignment form
            public string[] Arguments;  // invocation form (null when assigning)
        }

        internal static List<Directive> Parse(string spec)
        {
            var directives = new List<Directive>();

            foreach (var rawLine in spec.Split('\n'))
            {
                var line = rawLine.Trim().TrimEnd('\r').Trim();

                if (line.Length == 0 || line.StartsWith("#") || line.StartsWith("//"))
                {
                    continue;
                }

                // Invocation is checked first: an argument may itself contain
                // '=' (IL2CPP arguments invariably do), so testing for '='
                // first would misread `SetAdditionalIl2CppArgs("--x=1")` as an
                // assignment to a member called `SetAdditionalIl2CppArgs("--x`.
                var open = line.IndexOf('(');

                if (open > 0 && line.EndsWith(")"))
                {
                    var target = line.Substring(0, open).Trim();
                    var argumentText = line.Substring(open + 1, line.Length - open - 2);
                    string typeName, memberName;

                    if (!SplitQualifiedName(target, out typeName, out memberName))
                    {
                        Debug.LogWarning("[GameCI] Skipping unparseable directive: " + line);
                        continue;
                    }

                    directives.Add(new Directive
                    {
                        Source = line,
                        TypeName = typeName,
                        MemberName = memberName,
                        Arguments = SplitArguments(argumentText),
                    });

                    continue;
                }

                var equals = line.IndexOf('=');

                if (equals > 0)
                {
                    var target = line.Substring(0, equals).Trim();
                    var value = line.Substring(equals + 1).Trim();
                    string typeName, memberName;

                    if (!SplitQualifiedName(target, out typeName, out memberName))
                    {
                        Debug.LogWarning("[GameCI] Skipping unparseable directive: " + line);
                        continue;
                    }

                    directives.Add(new Directive
                    {
                        Source = line,
                        TypeName = typeName,
                        MemberName = memberName,
                        Value = value,
                    });

                    continue;
                }

                Debug.LogWarning("[GameCI] Skipping unparseable directive: " + line);
            }

            return directives;
        }

        /// <summary>
        /// Splits `A.B.C` into type `A.B` and member `C`. The type half may be
        /// a bare name or namespace-qualified; only the final segment is ever
        /// the member.
        /// </summary>
        static bool SplitQualifiedName(string target, out string typeName, out string memberName)
        {
            typeName = null;
            memberName = null;

            var lastDot = target.LastIndexOf('.');

            if (lastDot <= 0 || lastDot == target.Length - 1)
            {
                return false;
            }

            typeName = target.Substring(0, lastDot).Trim();
            memberName = target.Substring(lastDot + 1).Trim();

            return typeName.Length > 0 && memberName.Length > 0;
        }

        /// <summary>
        /// Splits an argument list on commas that are not inside a quoted
        /// string, so a quoted argument containing a comma survives intact.
        /// </summary>
        internal static string[] SplitArguments(string text)
        {
            var arguments = new List<string>();

            if (text.Trim().Length == 0)
            {
                return arguments.ToArray();
            }

            var current = new StringBuilder();
            var inQuotes = false;

            for (var index = 0; index < text.Length; index++)
            {
                var character = text[index];

                if (character == '"')
                {
                    inQuotes = !inQuotes;
                    current.Append(character);
                }
                else if (character == ',' && !inQuotes)
                {
                    arguments.Add(current.ToString().Trim());
                    current.Length = 0;
                }
                else
                {
                    current.Append(character);
                }
            }

            arguments.Add(current.ToString().Trim());

            return arguments.ToArray();
        }

        // --- Application ---------------------------------------------------

        static bool ApplyDirective(Directive directive, out string error)
        {
            var type = ResolveType(directive.TypeName);

            if (type == null)
            {
                error = "no such type (searched all loaded assemblies)";

                return false;
            }

            return directive.Arguments != null
                ? InvokeMethod(type, directive, out error)
                : AssignMember(type, directive, out error);
        }

        const BindingFlags MemberFlags =
            BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance | BindingFlags.FlattenHierarchy;

        static bool AssignMember(Type type, Directive directive, out string error)
        {
            var property = type.GetProperty(directive.MemberName, MemberFlags);

            if (property != null)
            {
                if (!property.CanWrite)
                {
                    error = "property is read-only";

                    return false;
                }

                object converted;

                if (!TryConvert(directive.Value, property.PropertyType, out converted, out error))
                {
                    return false;
                }

                property.SetValue(null, converted, null);
                error = null;

                return true;
            }

            var field = type.GetField(directive.MemberName, MemberFlags);

            if (field != null)
            {
                object converted;

                if (!TryConvert(directive.Value, field.FieldType, out converted, out error))
                {
                    return false;
                }

                field.SetValue(null, converted);
                error = null;

                return true;
            }

            error = "no such property or field";

            return false;
        }

        static bool InvokeMethod(Type type, Directive directive, out string error)
        {
            var candidates = type.GetMethods(MemberFlags)
                .Where(method => method.Name == directive.MemberName)
                .Where(method => method.GetParameters().Length == directive.Arguments.Length)
                .ToArray();

            if (candidates.Length == 0)
            {
                error = string.Format("no such method taking {0} argument(s)", directive.Arguments.Length);

                return false;
            }

            var reasons = new List<string>();

            // Overloads are tried in turn and the first whose parameters all
            // convert wins, which is how `SetIl2CppCodeGeneration(Standalone,
            // OptimizeSize)` resolves without the caller naming types.
            foreach (var candidate in candidates)
            {
                var parameters = candidate.GetParameters();
                var values = new object[parameters.Length];
                var converted = true;

                for (var index = 0; index < parameters.Length; index++)
                {
                    string conversionError;

                    if (!TryConvert(directive.Arguments[index], parameters[index].ParameterType,
                            out values[index], out conversionError))
                    {
                        reasons.Add(conversionError);
                        converted = false;

                        break;
                    }
                }

                if (!converted)
                {
                    continue;
                }

                candidate.Invoke(null, values);
                error = null;

                return true;
            }

            error = "no overload matched: " + string.Join("; ", reasons.Distinct().ToArray());

            return false;
        }

        static Type ResolveType(string name)
        {
            // Fully-qualified names are tried first so an explicit
            // UnityEditor.EditorSettings always beats a same-named type in
            // some other assembly.
            var matches = AppDomain.CurrentDomain.GetAssemblies()
                .SelectMany(SafeGetTypes)
                .Where(type => type.FullName == name)
                .ToArray();

            if (matches.Length > 0)
            {
                return matches[0];
            }

            // Bare names resolve against UnityEditor/UnityEngine first, so
            // `PlayerSettings` means Unity's rather than a project type that
            // happens to share the name.
            var byShortName = AppDomain.CurrentDomain.GetAssemblies()
                .SelectMany(SafeGetTypes)
                .Where(type => type.Name == name)
                .OrderBy(type => IsUnityNamespace(type.Namespace) ? 0 : 1)
                .ToArray();

            return byShortName.Length > 0 ? byShortName[0] : null;
        }

        static bool IsUnityNamespace(string space)
        {
            return space != null && (space == "UnityEditor" || space == "UnityEngine"
                || space.StartsWith("UnityEditor.") || space.StartsWith("UnityEngine."));
        }

        static IEnumerable<Type> SafeGetTypes(Assembly assembly)
        {
            // A partially-loadable assembly (common with optional packages)
            // must not take the whole scan down with it.
            try
            {
                return assembly.GetTypes();
            }
            catch (ReflectionTypeLoadException exception)
            {
                return exception.Types.Where(type => type != null);
            }
            catch (Exception)
            {
                return new Type[0];
            }
        }

        static bool TryConvert(string raw, Type target, out object value, out string error)
        {
            value = null;
            error = null;

            var text = raw.Trim();

            if (text.Length >= 2 && text.StartsWith("\"") && text.EndsWith("\""))
            {
                text = text.Substring(1, text.Length - 2);
            }

            try
            {
                if (target == typeof(string))
                {
                    value = text;

                    return true;
                }

                if (target.IsEnum)
                {
                    // A qualified form (BuildTarget.Android) is accepted as
                    // well as a bare member, since that is how these read in
                    // C# and users will write them that way.
                    var member = text;
                    var lastDot = member.LastIndexOf('.');

                    if (lastDot >= 0)
                    {
                        member = member.Substring(lastDot + 1);
                    }

                    value = Enum.Parse(target, member, true);

                    return true;
                }

                if (target == typeof(bool))
                {
                    value = IsTruthy(text);

                    return true;
                }

                // NamedBuildTarget is a struct with static presets rather than
                // an enum, so `Standalone` has to resolve as a static member.
                if (!target.IsPrimitive && target != typeof(decimal))
                {
                    object preset;

                    if (TryResolveStaticPreset(text, target, out preset))
                    {
                        value = preset;

                        return true;
                    }
                }

                value = Convert.ChangeType(text, target, CultureInfo.InvariantCulture);

                return true;
            }
            catch (Exception exception)
            {
                error = string.Format("cannot convert \"{0}\" to {1} ({2})", raw, target.Name, exception.Message);

                return false;
            }
        }

        static bool TryResolveStaticPreset(string text, Type target, out object value)
        {
            value = null;

            var member = text;
            var lastDot = member.LastIndexOf('.');

            if (lastDot >= 0)
            {
                member = member.Substring(lastDot + 1);
            }

            var property = target.GetProperty(member, BindingFlags.Public | BindingFlags.Static);

            if (property != null && target.IsAssignableFrom(property.PropertyType))
            {
                value = property.GetValue(null, null);

                return true;
            }

            var field = target.GetField(member, BindingFlags.Public | BindingFlags.Static);

            if (field != null && target.IsAssignableFrom(field.FieldType))
            {
                value = field.GetValue(null);

                return true;
            }

            return false;
        }

        static bool IsTruthy(string value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return false;
            }

            var normalised = value.Trim().ToLowerInvariant();

            return normalised == "true" || normalised == "1" || normalised == "yes" || normalised == "on";
        }

        /// <summary>
        /// Re-applies the spec immediately before the player build. Settings
        /// that only affect the player are cheap to set twice, and this covers
        /// the case where a build method changed them after editor load.
        /// </summary>
        sealed class ReapplyBeforeBuild : IPreprocessBuildWithReport
        {
            // Negative so this runs ahead of project-owned callbacks, which
            // should still be able to override GameCI if they want to.
            public int callbackOrder { get { return -1000; } }

            public void OnPreprocessBuild(BuildReport report)
            {
                Apply("pre-build callback");
            }
        }
    }
}
