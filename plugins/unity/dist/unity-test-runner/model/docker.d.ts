import type { RunnerContext } from './action';
declare const Docker: {
    /**
     *  Remove a possible leftover container created by `Docker.run`.
     */
    ensureContainerRemoval(parameters: RunnerContext): Promise<void>;
    /**
     * `docker run` pulls an uncached image implicitly, but that folds the pull
     * time into the same session as Unity's license activation/hold/return
     * inside the container - and these images are huge (7-8GB+ for Windows
     * tags). A partial cache miss can take 15+ minutes to pull, and observed
     * in practice (unity-test-runner#310's CI) that's long enough for Unity's
     * own ephemeral ULF license session to fail to return cleanly
     * ("Serial number unavailable for ULF return") once the container
     * finally gets to run - a real failure, but one caused by pull time
     * eating into the license window, not by anything about the test itself.
     * Pulling explicitly first, before that window opens, avoids the whole
     * class of failure. A pull failure here is a real, non-retryable-by-us
     * problem (bad tag, registry down) and is left to fail with Docker's own
     * error rather than swallowed.
     */
    pull(image: any): Promise<void>;
    run(image: any, parameters: any, silent?: boolean): Promise<void>;
    getLinuxCommand(image: any, parameters: any): string;
    getWindowsCommand(image: any, parameters: any): string;
};
export default Docker;
