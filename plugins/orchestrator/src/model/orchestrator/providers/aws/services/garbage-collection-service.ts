import { DeleteStackCommand, DescribeStackResourcesCommand } from '@aws-sdk/client-cloudformation';
import { DeleteLogGroupCommand } from '@aws-sdk/client-cloudwatch-logs';
import { StopTaskCommand } from '@aws-sdk/client-ecs';
import Input from '../../../../input';
import OrchestratorLogger from '../../../services/core/orchestrator-logger';
import { TaskService } from './task-service';
import { AwsClientFactory } from '../aws-client-factory';

export class GarbageCollectionService {
  static isOlderThan(date: Date, maxAgeHours: number): boolean {
    const ageMs = Date.now() - date.getTime();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    return ageMs > maxAgeMs;
  }

  public static async cleanup(deleteResources = false, maxAgeHours: number = 24): Promise<string> {
    process.env.AWS_REGION = Input.region;
    const CF = AwsClientFactory.getCloudFormation();
    const ecs = AwsClientFactory.getECS();
    const cwl = AwsClientFactory.getCloudWatchLogs();
    const taskDefinitionsInUse = new Array();
    const tasks = await TaskService.getTasks();
    const output: string[] = [];
    const age = Number(maxAgeHours) || 24;

    for (const task of tasks) {
      const { taskElement, element } = task;
      taskDefinitionsInUse.push(taskElement.taskDefinitionArn);
      const taskName = taskElement.containers?.[0].name || taskElement.taskArn || 'unknown';
      if (
        age > 0 &&
        taskElement.createdAt &&
        !GarbageCollectionService.isOlderThan(taskElement.createdAt, age)
      ) {
        continue;
      }
      if (deleteResources) {
        OrchestratorLogger.log(`Stopping task ${taskName}`);
        await ecs.send(new StopTaskCommand({ task: taskElement.taskArn || '', cluster: element }));
        output.push(`Stopped task: ${taskName}`);
      } else {
        OrchestratorLogger.log(`[dry-run] Would stop task ${taskName}`);
        output.push(`[dry-run] Would stop task: ${taskName}`);
      }
    }

    const jobStacks = await TaskService.getCloudFormationJobStacks();
    for (const element of jobStacks) {
      if (element.StackName === 'game-ci' || element.TemplateDescription === 'Game-CI base stack') {
        OrchestratorLogger.log(`Skipping ${element.StackName} (base stack)`);
        continue;
      }

      if (
        (
          await CF.send(new DescribeStackResourcesCommand({ StackName: element.StackName }))
        ).StackResources?.some(
          (x) =>
            x.ResourceType === 'AWS::ECS::TaskDefinition' &&
            taskDefinitionsInUse.includes(x.PhysicalResourceId),
        )
      ) {
        OrchestratorLogger.log(`Skipping ${element.StackName} - active task running`);
        continue;
      }

      if (
        age > 0 &&
        element.CreationTime &&
        !GarbageCollectionService.isOlderThan(element.CreationTime, age)
      ) {
        continue;
      }

      if (deleteResources) {
        OrchestratorLogger.log(`Deleting ${element.StackName}`);
        await CF.send(new DeleteStackCommand({ StackName: element.StackName }));
        output.push(`Deleted stack: ${element.StackName}`);
      } else {
        OrchestratorLogger.log(`[dry-run] Would delete ${element.StackName}`);
        output.push(`[dry-run] Would delete stack: ${element.StackName}`);
      }
    }

    const logGroups = await TaskService.getLogGroups();
    for (const element of logGroups) {
      if (
        age > 0 &&
        element.creationTime &&
        !GarbageCollectionService.isOlderThan(new Date(element.creationTime), age)
      ) {
        continue;
      }

      if (deleteResources) {
        OrchestratorLogger.log(`Deleting ${element.logGroupName}`);
        await cwl.send(new DeleteLogGroupCommand({ logGroupName: element.logGroupName || '' }));
        output.push(`Deleted log group: ${element.logGroupName}`);
      } else {
        OrchestratorLogger.log(`[dry-run] Would delete ${element.logGroupName}`);
        output.push(`[dry-run] Would delete log group: ${element.logGroupName}`);
      }
    }

    const locks = await TaskService.getLocks();
    for (const element of locks) {
      OrchestratorLogger.log(`Lock: ${element.Key}`);
    }

    if (output.length === 0) {
      output.push('No resources matched garbage collection criteria');
    }

    return output.join('\n');
  }
}
