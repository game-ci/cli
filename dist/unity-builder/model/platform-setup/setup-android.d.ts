import { BuildParameters } from '..';
declare class SetupAndroid {
    static setup(buildParameters: BuildParameters): Promise<void>;
    private static setupAndroidRun;
}
export default SetupAndroid;
