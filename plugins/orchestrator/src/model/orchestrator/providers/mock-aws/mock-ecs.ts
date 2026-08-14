/**
 * Mock ECS service.
 *
 * Simulates RunTask, DescribeTasks, ListTasks, ListClusters, StopTask.
 * Tasks transition through PENDING → RUNNING → STOPPED lifecycle,
 * executing commands via local Docker when available or simulating output.
 */

import { MockAwsState, MockEcsTask } from './mock-aws-state';
import { MockKinesisProducer } from './mock-kinesis';
import OrchestratorLogger from '../../services/core/orchestrator-logger';

export class MockEcs {
  /** Run a new task on the mock ECS cluster. */
  static async runTask(params: {
    cluster: string;
    taskDefinition: string;
    overrides?: {
      containerOverrides?: Array<{
        name: string;
        command?: string[];
        environment?: Array<{ name: string; value: string }>;
      }>;
    };
    networkConfiguration?: any;
    launchType?: string;
    capacityProviderStrategy?: any[];
  }): Promise<{ tasks: MockEcsTask[] }> {
    const taskArn = MockAwsState.generateArn('ecs', 'task/game-ci');
    const containerName = params.overrides?.containerOverrides?.[0]?.name || 'container';
    const commands = params.overrides?.containerOverrides?.[0]?.command || [];

    OrchestratorLogger.log(`[mock-aws] RunTask: ${taskArn}`);
    OrchestratorLogger.log(`[mock-aws]   cluster: ${params.cluster}`);
    OrchestratorLogger.log(`[mock-aws]   image/taskDef: ${params.taskDefinition}`);
    OrchestratorLogger.log(`[mock-aws]   commands: ${commands.join(' ')}`);

    const task: MockEcsTask = {
      taskArn,
      clusterArn: params.cluster,
      taskDefinitionArn: params.taskDefinition,
      lastStatus: 'PENDING',
      desiredStatus: 'RUNNING',
      createdAt: new Date(),
      containers: [
        {
          name: containerName,
          lastStatus: 'PENDING',
          image: params.taskDefinition,
        },
      ],
      overrides: params.overrides,
    };

    MockAwsState.ecsTasks.set(taskArn, task);

    // Add to cluster's task list
    const clusterTasks = MockAwsState.ecsClusters.get(params.cluster) || [];
    clusterTasks.push(taskArn);
    MockAwsState.ecsClusters.set(params.cluster, clusterTasks);

    // Simulate async task lifecycle: PENDING → RUNNING → STOPPED
    MockEcs.simulateTaskLifecycle(taskArn, commands);

    return { tasks: [task] };
  }

  /** Describe tasks by ARN. */
  static describeTasks(params: { cluster: string; tasks: string[] }): { tasks: MockEcsTask[] } {
    const tasks: MockEcsTask[] = [];
    for (const arn of params.tasks) {
      const task = MockAwsState.ecsTasks.get(arn);
      if (task) tasks.push(task);
    }
    return { tasks };
  }

  /** List task ARNs for a cluster. */
  static listTasks(params: { cluster: string; nextToken?: string }): {
    taskArns: string[];
    nextToken?: string;
  } {
    const arns = MockAwsState.ecsClusters.get(params.cluster) || [];
    return { taskArns: arns };
  }

  /** List all cluster ARNs. */
  static listClusters(params?: { nextToken?: string }): {
    clusterArns: string[];
    nextToken?: string;
  } {
    return { clusterArns: [...MockAwsState.ecsClusters.keys()] };
  }

  /** Stop a running task. */
  static stopTask(params: { cluster: string; task: string; reason?: string }): void {
    const task = MockAwsState.ecsTasks.get(params.task);
    if (task) {
      task.lastStatus = 'STOPPED';
      task.desiredStatus = 'STOPPED';
      task.stoppedAt = new Date();
      task.stoppedReason = params.reason || 'Stopped by mock';
      task.containers[0].lastStatus = 'STOPPED';
      task.containers[0].exitCode = 1;
      OrchestratorLogger.log(`[mock-aws] StopTask: ${params.task}`);
    }
  }

  /** Wait until task reaches RUNNING state. */
  static async waitUntilTasksRunning(params: { tasks: string[]; cluster: string }): Promise<void> {
    // In mock, tasks transition quickly — just wait for the state change
    const maxWaitMs = 5000;
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const allRunning = params.tasks.every((arn) => {
        const task = MockAwsState.ecsTasks.get(arn);
        return task && (task.lastStatus === 'RUNNING' || task.lastStatus === 'STOPPED');
      });
      if (allRunning) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // ── Internal lifecycle simulation ──

  private static simulateTaskLifecycle(taskArn: string, commands: string[]): void {
    const task = MockAwsState.ecsTasks.get(taskArn);
    if (!task) return;

    // Transition to RUNNING after a brief delay
    setTimeout(() => {
      if (task.lastStatus === 'PENDING') {
        task.lastStatus = 'RUNNING';
        task.startedAt = new Date();
        task.containers[0].lastStatus = 'RUNNING';
        OrchestratorLogger.log(`[mock-aws] Task ${taskArn} → RUNNING`);

        // Produce mock log output via Kinesis
        const commandStr = commands.join(' ');
        MockKinesisProducer.produceTaskLogs(taskArn, commandStr);

        // Transition to STOPPED after "execution"
        setTimeout(() => {
          task.lastStatus = 'STOPPED';
          task.desiredStatus = 'STOPPED';
          task.stoppedAt = new Date();
          task.stoppedReason = 'Essential container in task exited';
          task.containers[0].lastStatus = 'STOPPED';
          task.containers[0].exitCode = 0;
          OrchestratorLogger.log(`[mock-aws] Task ${taskArn} → STOPPED (exit 0)`);
        }, 500);
      }
    }, 200);
  }
}
