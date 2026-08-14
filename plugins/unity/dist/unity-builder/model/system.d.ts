declare class System {
    static run(command: string, arguments_?: string[], options?: {}, shouldLog?: boolean): Promise<string>;
}
export default System;
