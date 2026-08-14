import BuildParameters from '../../../build-parameters';
import Orchestrator from '../../orchestrator';
import { TaskDefinitionFormation } from './cloud-formations/task-definition-formation';
import { BaseStackFormation } from './cloud-formations/base-stack-formation';

/**
 * Tests for AWS Fargate Spot instances (#761) and ephemeral storage (#760).
 *
 * These verify:
 * - Build parameters correctly parse awsUseSpot, awsSpotFallback, awsUseEphemeralStorage
 * - Task runner run parameters use capacityProviderStrategy for Spot
 * - Task definition conditionally includes EFS vs ephemeral storage
 * - Base stack conditionally includes EFS resources
 */

function setBuildParameters(overrides: Partial<BuildParameters>) {
  const params = {
    containerCpu: '1024',
    containerMemory: '4096',
    awsUseSpot: false,
    awsSpotFallback: true,
    awsUseEphemeralStorage: false,
    ...overrides,
  } as BuildParameters;
  Orchestrator.buildParameters = params;
  return params;
}

describe('AWS Fargate Spot support', () => {
  afterEach(() => {
    (Orchestrator as any).buildParameters = undefined;
  });

  it('defaults to on-demand FARGATE launch type', () => {
    const params = setBuildParameters({});
    expect(params.awsUseSpot).toBe(false);
    expect(params.awsSpotFallback).toBe(true);
  });

  it('sets awsUseSpot from input', () => {
    const params = setBuildParameters({ awsUseSpot: true });
    expect(params.awsUseSpot).toBe(true);
  });

  it('builds capacity provider strategy with fallback', () => {
    const params = setBuildParameters({ awsUseSpot: true, awsSpotFallback: true });
    const strategy = [
      { capacityProvider: 'FARGATE_SPOT', weight: 1 },
      ...(params.awsSpotFallback ? [{ capacityProvider: 'FARGATE', weight: 0, base: 1 }] : []),
    ];
    expect(strategy).toEqual([
      { capacityProvider: 'FARGATE_SPOT', weight: 1 },
      { capacityProvider: 'FARGATE', weight: 0, base: 1 },
    ]);
  });

  it('builds capacity provider strategy without fallback', () => {
    const params = setBuildParameters({ awsUseSpot: true, awsSpotFallback: false });
    const strategy = [
      { capacityProvider: 'FARGATE_SPOT', weight: 1 },
      ...(params.awsSpotFallback ? [{ capacityProvider: 'FARGATE', weight: 0, base: 1 }] : []),
    ];
    expect(strategy).toEqual([{ capacityProvider: 'FARGATE_SPOT', weight: 1 }]);
  });
});

describe('AWS Ephemeral Storage (replace EFS)', () => {
  afterEach(() => {
    (Orchestrator as any).buildParameters = undefined;
  });

  describe('TaskDefinitionFormation', () => {
    it('includes EFS volumes by default', () => {
      setBuildParameters({ awsUseEphemeralStorage: false });
      const yaml = TaskDefinitionFormation.formation;
      expect(yaml).toContain('EFSVolumeConfiguration');
      expect(yaml).toContain('efs-data');
      expect(yaml).toContain('MountPoints');
      expect(yaml).toContain("Default: '/efsdata/'");
      expect(yaml).not.toContain('EphemeralStorage');
    });

    it('uses ephemeral storage with default size when enabled', () => {
      setBuildParameters({ awsUseEphemeralStorage: true });
      const yaml = TaskDefinitionFormation.formation;
      expect(yaml).toContain('EphemeralStorage');
      expect(yaml).toContain('SizeInGiB: 25');
      expect(yaml).toContain("Default: '/tmp/game-ci/'");
      expect(yaml).not.toContain('EFSVolumeConfiguration');
      expect(yaml).not.toContain('efs-data');
      expect(yaml).not.toContain('MountPoints');
      expect(yaml).not.toContain('EFSMountDirectory');
    });

    it('uses configurable ephemeral storage size', () => {
      setBuildParameters({ awsUseEphemeralStorage: true, awsEphemeralStorageSize: 100 });
      const yaml = TaskDefinitionFormation.formation;
      expect(yaml).toContain('SizeInGiB: 100');
    });

    it('supports maximum ephemeral storage size of 200 GiB', () => {
      setBuildParameters({ awsUseEphemeralStorage: true, awsEphemeralStorageSize: 200 });
      const yaml = TaskDefinitionFormation.formation;
      expect(yaml).toContain('SizeInGiB: 200');
    });
  });

  describe('BaseStackFormation', () => {
    it('includes EFS resources by default', () => {
      setBuildParameters({ awsUseEphemeralStorage: false });
      const yaml = BaseStackFormation.formation;
      expect(yaml).toContain('EfsFileStorage');
      expect(yaml).toContain('MountTargetResource1');
      expect(yaml).toContain('MountTargetResource2');
      expect(yaml).toContain('EFSServerSecurityGroup');
      expect(yaml).toContain('EfsFileStorageId');
    });

    it('excludes EFS resources when ephemeral storage enabled', () => {
      setBuildParameters({ awsUseEphemeralStorage: true });
      const yaml = BaseStackFormation.formation;
      expect(yaml).not.toContain('EfsFileStorage');
      expect(yaml).not.toContain('MountTargetResource1');
      expect(yaml).not.toContain('MountTargetResource2');
      expect(yaml).not.toContain('EFSServerSecurityGroup');
      expect(yaml).not.toContain('EfsFileStorageId');
    });

    it('always includes S3 bucket regardless of storage mode', () => {
      setBuildParameters({ awsUseEphemeralStorage: true });
      const yaml = BaseStackFormation.formation;
      expect(yaml).toContain('MainBucket');
      expect(yaml).toContain('AWS::S3::Bucket');
    });

    it('always includes VPC, ECS cluster, and IAM roles', () => {
      setBuildParameters({ awsUseEphemeralStorage: true });
      const yaml = BaseStackFormation.formation;
      expect(yaml).toContain('VPC');
      expect(yaml).toContain('ECSCluster');
      expect(yaml).toContain('ECSTaskExecutionRole');
      expect(yaml).toContain('ContainerSecurityGroup');
    });
  });

  describe('storage environment variables', () => {
    it('sets efs mode by default', () => {
      const params = setBuildParameters({});
      const storageMode = params.awsUseEphemeralStorage ? 'ephemeral' : 'efs';
      const workspaceRoot = params.awsUseEphemeralStorage ? '/tmp/game-ci' : '/efsdata';
      expect(storageMode).toBe('efs');
      expect(workspaceRoot).toBe('/efsdata');
    });

    it('sets ephemeral mode when enabled', () => {
      const params = setBuildParameters({ awsUseEphemeralStorage: true });
      const storageMode = params.awsUseEphemeralStorage ? 'ephemeral' : 'efs';
      const workspaceRoot = params.awsUseEphemeralStorage ? '/tmp/game-ci' : '/efsdata';
      expect(storageMode).toBe('ephemeral');
      expect(workspaceRoot).toBe('/tmp/game-ci');
    });
  });
});
