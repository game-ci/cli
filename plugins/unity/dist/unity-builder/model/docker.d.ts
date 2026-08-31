import { ExecOptions } from '@actions/exec';
import { DockerParameters, StringKeyValuePair } from './shared-types';
declare class Docker {
    static detectDaemonOs(): Promise<string | undefined>;
    static resolveBuildPlatform(containerOs: string): Promise<string>;
    /**
     * `docker run` pulls an uncached image implicitly, but that folds the pull
     * time into the same session as Unity's license activation/hold/return
     * inside the container - and these images are huge (7-8GB+ for Windows
     * tags). A partial cache miss can take 15+ minutes to pull, which is long
     * enough for Unity's own ephemeral ULF license session to fail to return
     * cleanly once the container finally gets to run - a real failure, but one
     * caused by pull time eating into the license window, not by anything
     * about the build itself. Pulling explicitly first, before that window
     * opens, avoids the whole class of failure. A pull failure here is a real,
     * non-retryable-by-us problem (bad tag, registry down) and is left to fail
     * with Docker's own error rather than swallowed.
     */
    static pull(image: string): Promise<void>;
    static run(image: string, parameters: DockerParameters, silent?: boolean, overrideCommands?: string, additionalVariables?: StringKeyValuePair[], options?: ExecOptions, entrypointBash?: boolean): Promise<number>;
    static getLinuxCommand(image: string, parameters: DockerParameters, overrideCommands?: string, additionalVariables?: StringKeyValuePair[], entrypointBash?: boolean): string;
    static getWindowsCommand(image: string, parameters: DockerParameters): string;
}
export default Docker;
