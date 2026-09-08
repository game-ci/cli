import { describe, expect, it } from 'vitest';

import { ImageTag } from './image-tag';

describe('ImageTag', () => {
  describe('tag', () => {
    it('maps StandaloneWindows64 to the windows-mono suffix used on Docker Hub', () => {
      const image = new ImageTag({
        editorVersion: '6000.4.7f1',
        targetPlatform: 'StandaloneWindows64',
        builderPlatform: 'linux',
      });

      expect(image.tag).toBe('6000.4.7f1-windows-mono-3');
      expect(image.toString()).toBe('unityci/editor:6000.4.7f1-windows-mono-3');
    });

    it('maps StandaloneLinux64 to linux-il2cpp', () => {
      const image = new ImageTag({
        editorVersion: '6000.4.7f1',
        targetPlatform: 'StandaloneLinux64',
        builderPlatform: 'linux',
      });

      expect(image.tag).toBe('6000.4.7f1-linux-il2cpp-3');
    });

    it('maps StandaloneOSX to mac-mono', () => {
      const image = new ImageTag({
        editorVersion: '6000.4.7f1',
        targetPlatform: 'StandaloneOSX',
        builderPlatform: 'darwin',
      });

      expect(image.tag).toBe('6000.4.7f1-mac-mono-3');
    });

    it('lowercases unmapped target platforms', () => {
      const image = new ImageTag({
        editorVersion: '6000.4.7f1',
        targetPlatform: 'SomeCustomPlatform',
        builderPlatform: 'linux',
      });

      expect(image.tag).toBe('6000.4.7f1-somecustomplatform-3');
    });
  });

  describe('toString', () => {
    it('returns the explicit customImage when provided, bypassing tag composition', () => {
      const image = new ImageTag({
        editorVersion: '6000.4.7f1',
        targetPlatform: 'StandaloneWindows64',
        builderPlatform: 'linux',
        customImage: 'private-registry.example.com/custom-editor:tag',
      });

      expect(image.toString()).toBe('private-registry.example.com/custom-editor:tag');
    });

    it('prefixes the image with the builder platform via getImagePlatformPrefixes', () => {
      const image = new ImageTag({
        editorVersion: '6000.4.7f1',
        targetPlatform: 'StandaloneWindows64',
        builderPlatform: 'win32',
      });

      expect(image.toString()).toBe('unityci/windows-editor:6000.4.7f1-windows-mono-3');
    });
  });

  // Real bug (game-ci/cli#248): several callers built the overrides object
  // passed into BuildParameters.create() with `unityVersion:
  // UnityVersioning.determineUnityVersion(...)` (an async function) without
  // awaiting it. The unresolved Promise flowed through untyped properties
  // all the way to this constructor and got silently stringified as
  // "[object Promise]" inside the Docker image tag, which then failed to
  // pull with no indication of the real cause.
  describe('editorVersion validation', () => {
    it('throws a clear error when editorVersion is a Promise instead of a resolved string', () => {
      expect(
        () =>
          new ImageTag({
            editorVersion: Promise.resolve('6000.4.7f1') as unknown as string,
            targetPlatform: 'StandaloneLinux64',
            builderPlatform: 'linux',
          }),
      ).toThrow(/forgot to `await`/);
    });

    it('does not throw for a normal resolved string', () => {
      expect(
        () =>
          new ImageTag({
            editorVersion: '6000.4.7f1',
            targetPlatform: 'StandaloneLinux64',
            builderPlatform: 'linux',
          }),
      ).not.toThrow();
    });

    it('does not throw for the default empty editorVersion', () => {
      expect(() => new ImageTag({ targetPlatform: 'StandaloneLinux64', builderPlatform: 'linux' })).not.toThrow();
    });
  });
});
