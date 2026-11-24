/**
 * The shell command that runs this game-ci CLI again, for plugins that hand
 * work back to it (the orchestrator's remote-cli commands on a host build).
 *
 * A compiled binary is its own executable. Otherwise an interpreter (node or
 * bun) runs the script, which comes along as the second argument.
 */
export const CliCommand = {
  of(execPath: string, scriptPath: string | undefined): string {
    const interpreter = execPath.split(/[\\/]/).pop()?.toLowerCase() ?? "";
    const isInterpreter = /^(node|bun)(\.exe)?$/.test(interpreter);

    return isInterpreter && scriptPath ? `${quote(execPath)} ${quote(scriptPath)}` : quote(execPath);
  },
} as const;

function quote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
