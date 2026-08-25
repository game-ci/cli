import { RunnerImageTag } from './runner-image-tag.ts';

describe('RunnerImageTag', () => {
  const some = {
    engineVersion: '2099.9.f9f9',
    targetPlatform: 'Test',
    builderPlatform: '',
  };

  const defaults = {
    repository: 'unityci',
    name: 'editor',
    image: 'unityci/editor',
  };

  describe('constructor', () => {
    it('can be called', () => {
      const { targetPlatform } = some;

      expect(() => new RunnerImageTag({ targetPlatform })).not.toThrow();
    });

    it('accepts parameters and sets the right properties', () => {
      const image = new RunnerImageTag(some);

      expect(image.repository).toStrictEqual('unityci');
      expect(image.name).toStrictEqual('editor');
      expect(image.engineVersion).toStrictEqual(some.engineVersion);
      expect(image.targetPlatform).toStrictEqual(some.targetPlatform);
      expect(image.builderPlatform).toStrictEqual(some.builderPlatform);
    });

    test.each(['2000.0.0f0', '2011.1.11f1', '6000.0.36f1'])('accepts %p version format', (version) => {
      expect(() => new RunnerImageTag({ engineVersion: version, targetPlatform: some.targetPlatform })).not.toThrow();
    });

    test.each(['some version', ''])('throws for incorrect version %p', (engineVersion) => {
      const { targetPlatform } = some;
      expect(() => new RunnerImageTag({ engineVersion, targetPlatform })).toThrow();
    });

    test.each([undefined, 'nonExisting'])('throws for unsupported target %p', (targetPlatform) => {
      expect(() => new RunnerImageTag({ targetPlatform })).toThrow();
    });
  });

  describe('toString', () => {
    // Rolling version defaults to "3", matching unity-builder's production
    // default (Input.containerRegistryImageVersion) - this used to be
    // hardcoded to "1" here, which meant cli resolved a stale image tag.
    it('returns the correct version', () => {
      const image = new RunnerImageTag({
        engineVersion: '2099.1.1111',
        targetPlatform: some.targetPlatform,
        hostPlatform: process.platform,
      });
      switch (process.platform) {
        case 'win32':
          expect(image.toString()).toStrictEqual(`${defaults.image}:windows-2099.1.1111-3`);
          break;
        case 'linux':
          expect(image.toString()).toStrictEqual(`${defaults.image}:ubuntu-2099.1.1111-3`);
          break;
      }
    });
    it('returns customImage if given', () => {
      const image = new RunnerImageTag({
        engineVersion: '2099.1.1111',
        targetPlatform: some.targetPlatform,
        hostPlatform: process.platform,
        customImage: `${defaults.image}:2099.1.1111@347598437689743986`,
      });

      expect(image.toString()).toStrictEqual(image.customImage);
    });

    it('returns the specific build platform', () => {
      const image = new RunnerImageTag({
        engineVersion: '2019.2.11f1',
        targetPlatform: 'WebGL',
        hostPlatform: process.platform,
      });

      switch (process.platform) {
        case 'win32':
          expect(image.toString()).toStrictEqual(`${defaults.image}:windows-2019.2.11f1-webgl-3`);
          break;
        case 'linux':
          expect(image.toString()).toStrictEqual(`${defaults.image}:ubuntu-2019.2.11f1-webgl-3`);
          break;
      }
    });

    // Real bug (game-ci/unity-activate#111): this used to resolve to an
    // empty suffix, producing "ubuntu-2019.2.11f1-3" - a tag unityci/editor
    // never publishes ("manifest unknown" on docker pull). NoTarget/generic
    // now resolves to the same 'base' image StandaloneLinux64 uses.
    it("resolves generic targetPlatforms to the 'base' image, not an empty suffix", () => {
      const image = new RunnerImageTag({
        targetPlatform: 'NoTarget',
        hostPlatform: process.platform,
      });

      switch (process.platform) {
        case 'win32':
          expect(image.toString()).toStrictEqual(`${defaults.image}:windows-2019.2.11f1-base-3`);
          break;
        case 'linux':
          expect(image.toString()).toStrictEqual(`${defaults.image}:ubuntu-2019.2.11f1-base-3`);
          break;
      }
    });

    it('honors an overridden containerRegistryRepository, keeping a host+path prefix intact', () => {
      const image = new RunnerImageTag({
        targetPlatform: 'NoTarget',
        hostPlatform: process.platform,
        containerRegistryRepository: 'ghcr.io/example/editor',
      });

      expect(image.repository).toStrictEqual('ghcr.io/example');
      expect(image.name).toStrictEqual('editor');
    });

    it('honors an overridden containerRegistryImageVersion', () => {
      const image = new RunnerImageTag({
        targetPlatform: 'NoTarget',
        hostPlatform: process.platform,
        containerRegistryImageVersion: '5',
      });

      expect(image.imageRollingVersion).toStrictEqual(5);
    });
  });
});
