declare class ImageEnvironmentFactory {
    static getEnvVarString(parameters: any): string;
    static getEnvironmentVariables(parameters: any): {
        name: string;
        value: any;
    }[];
}
export default ImageEnvironmentFactory;
