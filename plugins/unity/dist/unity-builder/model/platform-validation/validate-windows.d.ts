import { BuildParameters } from '..';
declare class ValidateWindows {
    static validate(buildParameters: BuildParameters): void;
    private static validateWindowsPlatformRequirements;
    private static checkForWin10SDK;
    private static checkForVisualStudio;
}
export default ValidateWindows;
