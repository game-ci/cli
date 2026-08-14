/**
 * Mock AWS Provider — sibling to the real AWS provider and MiniStack.
 *
 * Implements the full ProviderInterface using in-memory mock services
 * for CloudFormation, ECS/Fargate, S3, Kinesis, and CloudWatch Logs.
 *
 * Use cases:
 *   - CI testing without MiniStack or real AWS credentials
 *   - Fast unit/integration tests for orchestrator logic
 *   - Validating CloudFormation template parsing and task lifecycle
 *   - Developing against the AWS pipeline offline
 *
 * The mock is designed to be corrected as drift from real AWS is reported.
 * If behavior differs from real AWS, open an issue with the `mock-drift` label.
 */

import BuildParameters from '../../../build-parameters';
import OrchestratorEnvironmentVariable from '../../options/orchestrator-environment-variable';
import OrchestratorSecret from '../../options/orchestrator-secret';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { ProviderInterface } from '../provider-interface';
import { ProviderResource } from '../provider-resource';
import { ProviderWorkflow } from '../provider-workflow';
import { MockAwsState } from './mock-aws-state';
import { MockCloudFormation } from './mock-cloudformation';
import { MockEcs } from './mock-ecs';
import { MockS3 } from './mock-s3';
import { MockKinesis } from './mock-kinesis';
import { MockCloudWatchLogs } from './mock-cloudwatch-logs';

class MockAWSBuildEnvironment implements ProviderInterface {
  private baseStackName: string;

  constructor(buildParameters: BuildParameters) {
    this.baseStackName = buildParameters.awsStackName || 'game-ci-mock';
    OrchestratorLogger.log(`[mock-aws] Initialized with stack: ${this.baseStackName}`);
  }

  async setupWorkflow(
    buildGuid: string,
    buildParameters: BuildParameters,
    branchName: string,
    defaultSecretsArray: {
      ParameterKey: string;
      EnvironmentVariable: string;
      ParameterValue: string;
    }[],
  ): Promise<void> {
    OrchestratorLogger.log(`[mock-aws] setupWorkflow: ${buildGuid}`);

    // Create base stack (VPC, ECS cluster, S3 bucket, IAM roles)
    if (!MockAwsState.stacks.has(this.baseStackName)) {
      MockCloudFormation.createStack({
        StackName: this.baseStackName,
        TemplateBody: 'ECSCluster base stack',
      });
    }

    OrchestratorLogger.log(`[mock-aws] Base stack ready: ${this.baseStackName}`);
  }

  async runTaskInWorkflow(
    buildGuid: string,
    image: string,
    commands: string,
    mountdir: string,
    workingdir: string,
    environment: OrchestratorEnvironmentVariable[],
    secrets: OrchestratorSecret[],
  ): Promise<string> {
    OrchestratorLogger.log(`[mock-aws] runTaskInWorkflow: ${buildGuid}`);
    OrchestratorLogger.log(`[mock-aws]   image: ${image}`);
    OrchestratorLogger.log(`[mock-aws]   commands: ${commands}`);

    const startTimeMs = Date.now();

    // Create job-specific stack (task definition, Kinesis stream, log group)
    const jobStackName = `${this.baseStackName}-${buildGuid}`;
    MockCloudFormation.createStack({
      StackName: jobStackName,
    });

    const postSetupMs = Date.now();
    OrchestratorLogger.log(
      `[mock-aws] Setup job time: ${Math.floor((postSetupMs - startTimeMs) / 1000)}s`,
    );

    // Get resources from stacks
    const baseResources = MockCloudFormation.describeStackResources({
      StackName: this.baseStackName,
    }).StackResources;
    const jobResources = MockCloudFormation.describeStackResources({
      StackName: jobStackName,
    }).StackResources;

    const cluster =
      baseResources.find((r) => r.LogicalResourceId === 'ECSCluster')?.PhysicalResourceId || '';
    const taskDefinition =
      jobResources.find((r) => r.LogicalResourceId === 'TaskDefinition')?.PhysicalResourceId || '';
    const streamName =
      jobResources.find((r) => r.LogicalResourceId === 'KinesisStream')?.PhysicalResourceId || '';

    // Merge secrets into environment
    const secretsAsEnv = secrets.map((s) => ({
      name: s.EnvironmentVariable,
      value: s.ParameterValue,
    }));
    const mergedEnv = [...environment, ...secretsAsEnv];

    // Run the ECS task
    const result = await MockEcs.runTask({
      cluster,
      taskDefinition,
      overrides: {
        containerOverrides: [
          {
            name: jobStackName,
            command: ['-c', commands],
            environment: mergedEnv,
          },
        ],
      },
    });

    const taskArn = result.tasks[0]?.taskArn || '';
    OrchestratorLogger.log(`[mock-aws] Task started: ${taskArn}`);

    // Wait for task to run
    await MockEcs.waitUntilTasksRunning({ tasks: [taskArn], cluster });
    OrchestratorLogger.log(`[mock-aws] Task running`);

    // Stream logs from Kinesis (same pattern as real AwsTaskRunner)
    let output = '';
    const maxWaitMs = 10000;
    const startWait = Date.now();

    while (Date.now() - startWait < maxWaitMs) {
      const task = MockAwsState.ecsTasks.get(taskArn);
      if (!task) break;

      // Read Kinesis records
      const stream = MockAwsState.kinesisStreams.get(streamName);
      if (stream && stream.records.length > 0) {
        const records = MockKinesis.getRecords({
          ShardIterator: `mock-iterator:${streamName}:0`,
        });

        for (const record of records.Records) {
          try {
            const { gunzipSync } = await import('node:zlib');
            const json = JSON.parse(
              gunzipSync(Buffer.from(record.Data, 'base64')).toString('utf8'),
            );
            if (json.messageType === 'DATA_MESSAGE') {
              for (const logEvent of json.logEvents) {
                output += logEvent.message + '\n';
                OrchestratorLogger.log(logEvent.message);
              }
            }
          } catch {
            // Skip malformed records
          }
        }
      }

      if (task.lastStatus === 'STOPPED') {
        const exitCode = task.containers[0]?.exitCode;
        const postRunMs = Date.now();
        OrchestratorLogger.log(
          `[mock-aws] Run job time: ${Math.floor((postRunMs - postSetupMs) / 1000)}s`,
        );

        // Cleanup job stack
        MockCloudFormation.deleteStack({ StackName: jobStackName });
        OrchestratorLogger.log(`[mock-aws] Cleanup complete`);

        if (exitCode !== 0) {
          throw new Error(`Container exited with code ${exitCode}`);
        }

        return output;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Cleanup on timeout
    MockCloudFormation.deleteStack({ StackName: jobStackName });
    throw new Error('[mock-aws] Task timed out');
  }

  async cleanupWorkflow(
    buildParameters: BuildParameters,
    branchName: string,
    defaultSecretsArray: {
      ParameterKey: string;
      EnvironmentVariable: string;
      ParameterValue: string;
    }[],
  ): Promise<void> {
    OrchestratorLogger.log(`[mock-aws] cleanupWorkflow`);
  }

  async garbageCollect(
    filter: string,
    previewOnly: boolean,
    olderThan: number,
    fullCache: boolean,
    baseDependencies: boolean,
  ): Promise<string> {
    OrchestratorLogger.log(`[mock-aws] garbageCollect (preview=${previewOnly})`);

    const stacks = MockCloudFormation.listStacks().StackSummaries.filter(
      (s) => s.StackStatus !== 'DELETE_COMPLETE',
    );

    const logGroups = MockCloudWatchLogs.describeLogGroups().logGroups;
    const clusters = MockEcs.listClusters().clusterArns;

    let cleaned = 0;

    if (!previewOnly) {
      // Delete old stacks
      for (const stack of stacks) {
        if (stack.TemplateDescription === 'game-ci base stack') continue; // Don't delete base
        MockCloudFormation.deleteStack({ StackName: stack.StackName });
        cleaned++;
      }

      // Delete log groups
      for (const group of logGroups) {
        MockCloudWatchLogs.deleteLogGroup({ logGroupName: group.logGroupName });
        cleaned++;
      }
    }

    const summary = `[mock-aws] GC: ${stacks.length} stacks, ${logGroups.length} log groups, ${clusters.length} clusters. Cleaned: ${cleaned}`;
    OrchestratorLogger.log(summary);
    return summary;
  }

  async listResources(): Promise<ProviderResource[]> {
    const stacks = MockCloudFormation.listStacks().StackSummaries;
    const logGroups = MockCloudWatchLogs.describeLogGroups().logGroups;
    const clusters = MockEcs.listClusters().clusterArns;

    OrchestratorLogger.log(
      `[mock-aws] Resources: ${stacks.length} stacks, ${logGroups.length} log groups, ${clusters.length} clusters`,
    );

    const resources: ProviderResource[] = [];
    for (const stack of stacks) {
      const r = new ProviderResource();
      r.Name = `stack:${stack.StackName}`;
      resources.push(r);
    }
    for (const group of logGroups) {
      const r = new ProviderResource();
      r.Name = `loggroup:${group.logGroupName}`;
      resources.push(r);
    }

    return resources;
  }

  async listWorkflow(): Promise<ProviderWorkflow[]> {
    const tasks: ProviderWorkflow[] = [];
    for (const [arn, task] of MockAwsState.ecsTasks) {
      const w = new ProviderWorkflow();
      w.Name = `${arn} (${task.lastStatus})`;
      tasks.push(w);
    }
    return tasks;
  }

  async watchWorkflow(): Promise<string> {
    const activeStreams = [...MockAwsState.kinesisStreams.keys()];
    OrchestratorLogger.log(`[mock-aws] Watching ${activeStreams.length} streams`);
    return `Watching ${activeStreams.length} mock Kinesis streams`;
  }
}

export default MockAWSBuildEnvironment;
