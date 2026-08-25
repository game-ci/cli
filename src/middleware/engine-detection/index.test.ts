import { describe, expect, it, mock } from 'bun:test';

mock.module('./engine-detector.ts', () => ({
  EngineDetector: class {
    detect() {
      return { engine: 'unity', engineVersion: '2021.3.45f1' };
    }
  },
}));

const { engineDetection } = await import('./index.ts');

describe('engineDetection', () => {
  it('auto-detects engine and engineVersion when neither is set', async () => {
    const argv: any = { projectPath: '/some/project' };
    await engineDetection(argv);

    expect(argv.engine).toBe('unity');
    expect(argv.engineVersion).toBe('2021.3.45f1');
  });

  it('respects an explicit --engineVersion instead of overwriting it', async () => {
    const argv: any = { projectPath: '/some/project', engineVersion: '6000.0.36f1' };
    await engineDetection(argv);

    expect(argv.engineVersion).toBe('6000.0.36f1');
    expect(argv.engine).toBe('unity');
  });

  it('respects an explicit --engine instead of overwriting it', async () => {
    const argv: any = { projectPath: '/some/project', engine: 'godot' };
    await engineDetection(argv);

    expect(argv.engine).toBe('godot');
    expect(argv.engineVersion).toBe('2021.3.45f1');
  });

  it('does not call the detector at all when both are already set', async () => {
    const argv: any = { projectPath: '/some/project', engine: 'godot', engineVersion: '4.3' };
    await engineDetection(argv);

    expect(argv.engine).toBe('godot');
    expect(argv.engineVersion).toBe('4.3');
  });
});
