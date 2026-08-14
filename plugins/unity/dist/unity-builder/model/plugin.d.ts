/**
 * Generic lifecycle contract for optional unity-builder plugins.
 *
 * Plugins read their own configuration from environment variables and GitHub
 * Actions inputs. Unity-builder only calls lifecycle hooks at the points where
 * an external implementation can extend or replace the local build flow.
 */
export interface Plugin {
    initialize(coreParameters: Record<string, any>, workspace: string): Promise<void>;
    /** Whether the plugin wants to handle the entire build. */
    canHandleBuild(): boolean;
    /**
     * Execute the build when canHandleBuild() returns true.
     * If the plugin needs to fall back to a local build, it returns
     * { exitCode: -1, fallbackToLocal: true }.
     */
    handleBuild(baseImage: string): Promise<{
        exitCode: number;
        fallbackToLocal?: boolean;
    }>;
    /** Pre-build hook for local builds. */
    beforeLocalBuild(workspace: string): Promise<void>;
    /** Post-build hook for local builds. */
    afterLocalBuild(workspace: string, exitCode: number): Promise<void>;
    /** Post-build hook for all build types. */
    handlePostBuild(exitCode: number): Promise<void>;
}
/**
 * Attempt to load the default optional plugin.
 *
 * Today the default implementation is @game-ci/orchestrator. The loader is
 * intentionally named after the generic plugin contract so additional plugin
 * implementations can be added without making orchestrator part of the core
 * abstraction.
 */
export declare function loadPlugin(moduleName?: string): Promise<Plugin | undefined>;
