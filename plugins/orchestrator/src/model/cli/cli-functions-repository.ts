/**
 * Bridge file — stub for CliFunctionsRepository and @CliFunction decorator.
 *
 * The orchestrator's remote-client and utility modules register CLI
 * functions with this decorator.
 */

interface CliFunctionEntry {
  key: string;
  description: string;
  target: any;
  propertyKey: string;
}

class CliFunctionsRepository {
  private static cliFunctions: CliFunctionEntry[] = [];
  private static cliFunctionSources: any[] = [];

  static PushCliFunction(key: string, description: string, target: any, propertyKey: string) {
    CliFunctionsRepository.cliFunctions.push({ key, description, target, propertyKey });
  }

  static GetCliFunctions(): CliFunctionEntry[] {
    return CliFunctionsRepository.cliFunctions;
  }

  static GetAllCliModes(): string[] {
    return CliFunctionsRepository.cliFunctions.map((f) => f.key);
  }

  static PushCliFunctionSource(source: any) {
    CliFunctionsRepository.cliFunctionSources.push(source);
  }
}

/**
 * Decorator — marks a static method as a CLI-invokable function.
 */
function CliFunction(key: string, description: string) {
  return function (_target: any, propertyKey: string, _descriptor: PropertyDescriptor) {
    CliFunctionsRepository.PushCliFunction(key, description, _target, propertyKey);
  };
}

export { CliFunctionsRepository, CliFunction };
export default CliFunctionsRepository;
