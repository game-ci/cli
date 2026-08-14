import type { RunnerContext } from './action';
declare const Docker: {
    /**
     *  Remove a possible leftover container created by `Docker.run`.
     */
    ensureContainerRemoval(parameters: RunnerContext): Promise<void>;
    run(image: any, parameters: any, silent?: boolean): Promise<void>;
    getLinuxCommand(image: any, parameters: any): string;
    getWindowsCommand(image: any, parameters: any): string;
};
export default Docker;
