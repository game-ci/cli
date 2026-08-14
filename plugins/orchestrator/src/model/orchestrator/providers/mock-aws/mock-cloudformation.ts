/**
 * Mock CloudFormation service.
 *
 * Simulates stack create/update/delete/describe/list operations.
 * When a stack is created, resources are auto-generated based on
 * the template description (base stack vs job stack).
 */

import { MockAwsState, MockStack, MockStackResource } from './mock-aws-state';
import OrchestratorLogger from '../../services/core/orchestrator-logger';

export class MockCloudFormation {
  /** Create a new stack with auto-generated resources. */
  static createStack(params: {
    StackName: string;
    TemplateBody?: string;
    Parameters?: { ParameterKey: string; ParameterValue: string }[];
  }): { StackId: string } {
    const stackName = params.StackName;
    OrchestratorLogger.log(`[mock-aws] CreateStack: ${stackName}`);

    if (MockAwsState.stacks.has(stackName)) {
      throw new Error(`Stack [${stackName}] already exists`);
    }

    // Parse template to determine stack type
    const isBaseStack =
      params.TemplateBody?.includes('ECSCluster') || params.TemplateBody?.includes('base stack');

    const resources = isBaseStack
      ? MockCloudFormation.generateBaseStackResources(stackName)
      : MockCloudFormation.generateJobStackResources(stackName);

    const stack: MockStack = {
      StackName: stackName,
      StackStatus: 'CREATE_COMPLETE',
      TemplateDescription: isBaseStack ? 'game-ci base stack' : undefined,
      CreationTime: new Date(),
      Resources: resources,
    };

    MockAwsState.stacks.set(stackName, stack);

    // Side effects: create associated resources
    if (isBaseStack) {
      const clusterArn =
        resources.find((r) => r.LogicalResourceId === 'ECSCluster')?.PhysicalResourceId || '';
      MockAwsState.ecsClusters.set(clusterArn, []);
      MockAwsState.s3Buckets.set(`${stackName}-bucket`, []);
    } else {
      // Job stack creates a Kinesis stream and log group
      const streamName =
        resources.find((r) => r.LogicalResourceId === 'KinesisStream')?.PhysicalResourceId || '';
      const logGroupName =
        resources.find((r) => r.LogicalResourceId === 'LogGroup')?.PhysicalResourceId || '';

      MockAwsState.kinesisStreams.set(streamName, {
        StreamName: streamName,
        StreamStatus: 'ACTIVE',
        Shards: [{ ShardId: 'shardId-000000000000' }],
        records: [],
      });

      MockAwsState.logGroups.set(logGroupName, {
        logGroupName,
        creationTime: Date.now(),
      });
    }

    return { StackId: MockAwsState.generateArn('cloudformation', `stack/${stackName}`) };
  }

  /** Update an existing stack. */
  static updateStack(params: { StackName: string; TemplateBody?: string }): void {
    const stack = MockAwsState.stacks.get(params.StackName);
    if (!stack) throw new Error(`Stack [${params.StackName}] does not exist`);
    stack.StackStatus = 'UPDATE_COMPLETE';
    OrchestratorLogger.log(`[mock-aws] UpdateStack: ${params.StackName}`);
  }

  /** Delete a stack and its associated resources. */
  static deleteStack(params: { StackName: string }): void {
    const stack = MockAwsState.stacks.get(params.StackName);
    if (!stack) return; // AWS silently accepts deleting non-existent stacks

    OrchestratorLogger.log(`[mock-aws] DeleteStack: ${params.StackName}`);

    // Clean up associated resources
    for (const resource of stack.Resources) {
      if (resource.ResourceType === 'AWS::ECS::Cluster') {
        MockAwsState.ecsClusters.delete(resource.PhysicalResourceId);
      }
      if (resource.ResourceType === 'AWS::Kinesis::Stream') {
        MockAwsState.kinesisStreams.delete(resource.PhysicalResourceId);
      }
      if (resource.ResourceType === 'AWS::Logs::LogGroup') {
        MockAwsState.logGroups.delete(resource.PhysicalResourceId);
      }
    }

    stack.StackStatus = 'DELETE_COMPLETE';
  }

  /** Describe stacks (optionally filtered by name). */
  static describeStacks(params?: { StackName?: string }): { Stacks: MockStack[] } {
    if (params?.StackName) {
      const stack = MockAwsState.stacks.get(params.StackName);
      return { Stacks: stack ? [stack] : [] };
    }
    return { Stacks: [...MockAwsState.stacks.values()] };
  }

  /** List stack summaries. */
  static listStacks(): {
    StackSummaries: Array<{
      StackName: string;
      StackStatus: string;
      TemplateDescription?: string;
      CreationTime: Date;
    }>;
  } {
    const summaries = [...MockAwsState.stacks.values()].map((s) => ({
      StackName: s.StackName,
      StackStatus: s.StackStatus,
      TemplateDescription: s.TemplateDescription,
      CreationTime: s.CreationTime,
    }));
    return { StackSummaries: summaries };
  }

  /** Describe stack resources. */
  static describeStackResources(params: { StackName: string }): {
    StackResources: MockStackResource[];
  } {
    const stack = MockAwsState.stacks.get(params.StackName);
    if (!stack) throw new Error(`Stack [${params.StackName}] does not exist`);
    return { StackResources: stack.Resources };
  }

  // ── Resource generators ──

  private static generateBaseStackResources(stackName: string): MockStackResource[] {
    return [
      {
        LogicalResourceId: 'ECSCluster',
        PhysicalResourceId: MockAwsState.generateArn('ecs', 'cluster/game-ci'),
        ResourceType: 'AWS::ECS::Cluster',
        ResourceStatus: 'CREATE_COMPLETE',
      },
      {
        LogicalResourceId: 'PublicSubnetOne',
        PhysicalResourceId: MockAwsState.generatePhysicalId('subnet'),
        ResourceType: 'AWS::EC2::Subnet',
        ResourceStatus: 'CREATE_COMPLETE',
      },
      {
        LogicalResourceId: 'PublicSubnetTwo',
        PhysicalResourceId: MockAwsState.generatePhysicalId('subnet'),
        ResourceType: 'AWS::EC2::Subnet',
        ResourceStatus: 'CREATE_COMPLETE',
      },
      {
        LogicalResourceId: 'ContainerSecurityGroup',
        PhysicalResourceId: MockAwsState.generatePhysicalId('sg'),
        ResourceType: 'AWS::EC2::SecurityGroup',
        ResourceStatus: 'CREATE_COMPLETE',
      },
      {
        LogicalResourceId: 'S3Bucket',
        PhysicalResourceId: `${stackName}-bucket`,
        ResourceType: 'AWS::S3::Bucket',
        ResourceStatus: 'CREATE_COMPLETE',
      },
      {
        LogicalResourceId: 'ECSTaskExecutionRole',
        PhysicalResourceId: MockAwsState.generateArn('iam', 'role/ecsTaskExecution'),
        ResourceType: 'AWS::IAM::Role',
        ResourceStatus: 'CREATE_COMPLETE',
      },
      {
        LogicalResourceId: 'ECSTaskRole',
        PhysicalResourceId: MockAwsState.generateArn('iam', 'role/ecsTask'),
        ResourceType: 'AWS::IAM::Role',
        ResourceStatus: 'CREATE_COMPLETE',
      },
    ];
  }

  private static generateJobStackResources(stackName: string): MockStackResource[] {
    return [
      {
        LogicalResourceId: 'TaskDefinition',
        PhysicalResourceId: MockAwsState.generateArn('ecs', 'task-definition/game-ci'),
        ResourceType: 'AWS::ECS::TaskDefinition',
        ResourceStatus: 'CREATE_COMPLETE',
      },
      {
        LogicalResourceId: 'KinesisStream',
        PhysicalResourceId: `${stackName}-stream`,
        ResourceType: 'AWS::Kinesis::Stream',
        ResourceStatus: 'CREATE_COMPLETE',
      },
      {
        LogicalResourceId: 'LogGroup',
        PhysicalResourceId: `${stackName}-logs`,
        ResourceType: 'AWS::Logs::LogGroup',
        ResourceStatus: 'CREATE_COMPLETE',
      },
    ];
  }
}
