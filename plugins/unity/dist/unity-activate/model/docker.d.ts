import ImageTag from './image-tag';
declare const Docker: {
    build(buildParameters: any, silent?: boolean): Promise<ImageTag>;
    /**
     * `docker run` pulls an uncached image implicitly, but that folds the pull
     * time into the same session as Unity's license activation inside the
     * container - and these images are huge (7-8GB+ for Windows tags). A
     * partial cache miss can take 15+ minutes to pull, which is long enough
     * for Unity's own ephemeral license session to fail to return cleanly once
     * the container finally gets to run - a real failure, but one caused by
     * pull time eating into the license window, not by anything about
     * activation itself. Pulling explicitly first, before that window opens,
     * avoids the whole class of failure. A pull failure here is a real,
     * non-retryable-by-us problem (bad tag, registry down) and is left to fail
     * with Docker's own error rather than swallowed.
     */
    pull(image: any): Promise<void>;
    run(image: any, parameters: any, silent?: boolean): Promise<void>;
};
export default Docker;
