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

    test.each(['2000.0.0f0', '2011.1.11f1'])('accepts %p version format', (version) => {
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
    it('returns the correct version', () => {
      const image = new RunnerImageTag({
        engineVersion: '2099.1.1111',
        targetPlatform: some.targetPlatform,
        hostPlatform: process.platform,
      });
      switch (process.platform) {
        case 'win32':
          expect(image.toString()).toStrictEqual(`${defaults.image}:windows-2099.1.1111-1`);
          break;
        case 'linux':
          expect(image.toString()).toStrictEqual(`${defaults.image}:ubuntu-2099.1.1111-1`);
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
          expect(image.toString()).toStrictEqual(`${defaults.image}:windows-2019.2.11f1-webgl-1`);
          break;
        case 'linux':
          expect(image.toString()).toStrictEqual(`${defaults.image}:ubuntu-2019.2.11f1-webgl-1`);
          break;
      }
    });

    it('returns no specific build platform for generic targetPlatforms', () => {
      const image = new RunnerImageTag({
        targetPlatform: 'NoTarget',
        hostPlatform: process.platform,
      });

      switch (process.platform) {
        case 'win32':
          expect(image.toString()).toStrictEqual(`${defaults.image}:windows-2019.2.11f1-1`);
          break;
        case 'linux':
          expect(image.toString()).toStrictEqual(`${defaults.image}:ubuntu-2019.2.11f1-1`);
          break;
      }
    });
  });
});
