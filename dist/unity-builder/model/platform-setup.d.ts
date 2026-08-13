import { BuildParameters } from '.';
declare class PlatformSetup {
    static setup(buildParameters: BuildParameters, actionFolder: string): Promise<void>;
    private static SetupShared;
}
export default PlatformSetup;
