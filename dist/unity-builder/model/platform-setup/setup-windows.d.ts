import { BuildParameters } from '..';
declare class SetupWindows {
    static setup(buildParameters: BuildParameters): Promise<void>;
    private static setupWindowsRun;
    private static generateWinSDKRegKeys;
}
export default SetupWindows;
