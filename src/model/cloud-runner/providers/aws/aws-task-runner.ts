import { aws, core, compress } from '../../../../dependencies.ts';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable.ts';
import CloudRunnerAWSTaskDef from './cloud-runner-aws-task-def.ts';
import CloudRunnerLogger from '../../services/cloud-runner-logger.ts';
import { Input } from '../../../index.ts';
import CloudRunner from '../../cloud-runner.ts';
import { CloudRunnerBuildCommandProcessor } from '../../services/cloud-runner-build-command-process.ts';
import { FollowLogStreamService } from '../../services/follow-log-stream-service.ts';

class AWSTaskRunner {
  static async runTask(
    taskDef: CloudRunnerAWSTaskDef,
    ECS: aws.ECS,
    CF: aws.CloudFormation,
    environment: CloudRunnerEnvironmentVariable[],
    buildGuid: string,
    commands: string,
  ) {
    const cluster = taskDef.baseResources?.find((x) => x.LogicalResourceId === 'ECSCluster')?.PhysicalResourceId || '';
    const taskDefinition =
      taskDef.taskDefResources?.find((x) => x.LogicalResourceId === 'TaskDefinition')?.PhysicalResourceId || '';
    const SubnetOne =
      taskDef.baseResources?.find((x) => x.LogicalResourceId === 'PublicSubnetOne')?.PhysicalResourceId || '';
    const SubnetTwo =
      taskDef.baseResources?.find((x) => x.LogicalResourceId === 'PublicSubnetTwo')?.PhysicalResourceId || '';
    const ContainerSecurityGroup =
      taskDef.baseResources?.find((x) => x.LogicalResourceId === 'ContainerSecurityGroup')?.PhysicalResourceId || '';
    const streamName =
      taskDef.taskDefResources?.find((x) => x.LogicalResourceId === 'KinesisStream')?.PhysicalResourceId || '';

    const task = await ECS.runTask({
      cluster,
      taskDefinition,
      platformVersion: '1.4.0',
      overrides: {
        containerOverrides: [
          {
            name: taskDef.taskDefStackName,
            environment,
            command: ['-c', CloudRunnerBuildCommandProcessor.ProcessCommands(commands, CloudRunner.buildParameters)],
          },
        ],
      },
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: [SubnetOne, SubnetTwo],
          assignPublicIp: 'ENABLED',
          securityGroups: [ContainerSecurityGroup],
        },
      },
    }).promise();
    const taskArn = task.tasks?.[0].taskArn || '';
    CloudRunnerLogger.log('Cloud runner job is starting');
    await AWSTaskRunner.waitUntilTaskRunning(ECS, taskArn, cluster);
    const { lastStatus } = await AWSTaskRunner.describeTasks(ECS, cluster, taskArn);
    CloudRunnerLogger.log(`Cloud runner job status is running ${lastStatus}`);
    const { output, shouldCleanup } = await this.streamLogsUntilTaskStops(
      ECS,
      CF,
      taskDef,
      cluster,
      taskArn,
      streamName,
    );
    const taskData = await AWSTaskRunner.describeTasks(ECS, cluster, taskArn);
    const exitCode = taskData.containers?.[0].exitCode;
    const wasSuccessful = exitCode === 0 || (exitCode === undefined && taskData.lastStatus === 'RUNNING');
    if (wasSuccessful) {
      CloudRunnerLogger.log(`Cloud runner job has finished successfully`);

      return { output, shouldCleanup };
    } else {
      if (taskData.stoppedReason === 'Essential container in task exited' && exitCode === 1) {
        throw new Error('Container exited with code 1');
      }
      const message = `Cloud runner job exit code ${exitCode}`;
      taskData.overrides = undefined;
      taskData.attachments = undefined;
      CloudRunnerLogger.log(`${message} ${JSON.stringify(taskData, undefined, 4)}`);
      throw new Error(message);
    }
  }

  private static async waitUntilTaskRunning(ECS: aws.ECS, taskArn: string, cluster: string) {
    try {
      await ECS.waitFor('tasksRunning', { tasks: [taskArn], cluster }).promise();
    } catch (error_) {
      const error = error_ as Error;
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const tasksDescription = await AWSTaskRunner.describeTasks(ECS, cluster, taskArn);
      CloudRunnerLogger.log(`Cloud runner job has ended ${tasksDescription.containers?.[0].lastStatus}`);

      log.error(error);
      Deno.exit(1);
    }
  }

  static async describeTasks(ECS: aws.ECS, clusterName: string, taskArn: string) {
    const tasks = await ECS.describeTasks({
      cluster: clusterName,
      tasks: [taskArn],
    }).promise();
    if (tasks.tasks?.[0]) {
      return tasks.tasks?.[0];
    } else {
      throw new Error('No task found');
    }
  }

  static async streamLogsUntilTaskStops(
    ECS: aws.ECS,
    CF: aws.CloudFormation,
    taskDef: CloudRunnerAWSTaskDef,
    clusterName: string,
    taskArn: string,
    kinesisStreamName: string,
  ) {
    const kinesis = new aws.Kinesis();
    const stream = await AWSTaskRunner.getLogStream(kinesis, kinesisStreamName);
    let iterator = await AWSTaskRunner.getLogIterator(kinesis, stream);

    const logBaseUrl = `https://${Input.region}.console.aws.amazon.com/cloudwatch/home?region=${Input.region}#logsV2:log-groups/log-group/${CloudRunner.buildParameters.awsBaseStackName}-${CloudRunner.buildParameters.buildGuid}`;
    CloudRunnerLogger.log(`You view the log stream on AWS Cloud Watch: ${logBaseUrl}`);
    let shouldReadLogs = true;
    let shouldCleanup = true;
    let timestamp: number = 0;
    let output = '';
    while (shouldReadLogs) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const taskData = await AWSTaskRunner.describeTasks(ECS, clusterName, taskArn);
      ({ timestamp, shouldReadLogs } = AWSTaskRunner.checkStreamingShouldContinue(taskData, timestamp, shouldReadLogs));
      ({ iterator, shouldReadLogs, output, shouldCleanup } = await AWSTaskRunner.handleLogStreamIteration(
        kinesis,
        iterator,
        shouldReadLogs,
        taskDef,
        output,
        shouldCleanup,
      ));
    }

    return { output, shouldCleanup };
  }

  private static async handleLogStreamIteration(
    kinesis: aws.Kinesis,
    iterator: string,
    shouldReadLogs: boolean,
    taskDef: CloudRunnerAWSTaskDef,
    output: string,
    shouldCleanup: boolean,
  ) {
    const records = await kinesis
      .getRecords({
        ShardIterator: iterator,
      })
      .promise();
    iterator = records.NextShardIterator || '';
    ({ shouldReadLogs, output, shouldCleanup } = AWSTaskRunner.logRecords(
      records,
      iterator,
      taskDef,
      shouldReadLogs,
      output,
      shouldCleanup,
    ));

    return { iterator, shouldReadLogs, output, shouldCleanup };
  }

  private static checkStreamingShouldContinue(taskData: aws.ECS.Task, timestamp: number, shouldReadLogs: boolean) {
    if (taskData?.lastStatus === 'UNKNOWN') {
      CloudRunnerLogger.log('## Cloud runner job unknwon');
    }
    if (taskData?.lastStatus !== 'RUNNING') {
      if (timestamp === 0) {
        CloudRunnerLogger.log('## Cloud runner job stopped, streaming end of logs');
        timestamp = Date.now();
      }
      if (timestamp !== 0 && Date.now() - timestamp > 30_000) {
        CloudRunnerLogger.log('## Cloud runner status is not RUNNING for 30 seconds, last query for logs');
        shouldReadLogs = false;
      }
      CloudRunnerLogger.log(`## Status of job: ${taskData.lastStatus}`);
    }

    return { timestamp, shouldReadLogs };
  }

  private static logRecords(
    records,
    iterator: string,
    taskDef: CloudRunnerAWSTaskDef,
    shouldReadLogs: boolean,
    output: string,
    shouldCleanup: boolean,
  ) {
    if (records.Records.length > 0 && iterator) {
      for (let index = 0; index < records.Records.length; index++) {
        const json = JSON.parse(
          compress.gunzipSync(Buffer.from(records.Records[index].Data as string, 'base64')).toString('utf8'),
        );
        if (json.messageType === 'DATA_MESSAGE') {
          for (let logEventsIndex = 0; logEventsIndex < json.logEvents.length; logEventsIndex++) {
            const message = json.logEvents[logEventsIndex].message;
            ({ shouldReadLogs, shouldCleanup, output } = FollowLogStreamService.handleIteration(
              message,
              shouldReadLogs,
              shouldCleanup,
              output,
            ));
          }
        }
      }
    }

    return { shouldReadLogs, output, shouldCleanup };
  }

  private static async getLogStream(kinesis: aws.Kinesis, kinesisStreamName: string) {
    return await kinesis
      .describeStream({
        StreamName: kinesisStreamName,
      })
      .promise();
  }

  private static async getLogIterator(kinesis: aws.Kinesis, stream) {
    const description = await kinesis
      .getShardIterator({
        ShardIteratorType: 'TRIM_HORIZON',
        StreamName: stream.StreamDescription.StreamName,
        ShardId: stream.StreamDescription.Shards[0].ShardId,
      })
      .promise();

    return description.ShardIterator || '';
  }
}
export default AWSTaskRunner;
