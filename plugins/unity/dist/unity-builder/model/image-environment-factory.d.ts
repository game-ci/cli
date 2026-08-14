import { DockerParameters, StringKeyValuePair } from './shared-types';
declare class ImageEnvironmentFactory {
    static getEnvVarString(parameters: DockerParameters, additionalVariables?: StringKeyValuePair[]): string;
    static getEnvironmentVariables(parameters: DockerParameters, additionalVariables?: StringKeyValuePair[]): StringKeyValuePair[];
}
export default ImageEnvironmentFactory;
