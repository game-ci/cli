declare class MacBuilder {
    private static readonly TRANSIENT_LICENSING_ERROR_PATTERN;
    private static readonly MAX_ATTEMPTS;
    private static readonly RETRY_DELAY_MS;
    static run(actionFolder: string, silent?: boolean): Promise<number>;
}
export default MacBuilder;
