import { ExecOptions } from '@actions/exec';
import { DockerParameters, StringKeyValuePair } from './shared-types';
declare class Docker {
    static run(image: string, parameters: DockerParameters, silent?: boolean, overrideCommands?: string, additionalVariables?: StringKeyValuePair[], options?: ExecOptions, entrypointBash?: boolean): Promise<number>;
    static getLinuxCommand(image: string, parameters: DockerParameters, overrideCommands?: string, additionalVariables?: StringKeyValuePair[], entrypointBash?: boolean): string;
    static getWindowsCommand(image: string, parameters: DockerParameters): string;
}
export default Docker;
