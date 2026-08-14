import { MockAwsState } from './mock-aws-state';
import { MockCloudFormation } from './mock-cloudformation';
import { MockEcs } from './mock-ecs';
import { MockS3 } from './mock-s3';
import { MockKinesis } from './mock-kinesis';
import { MockCloudWatchLogs } from './mock-cloudwatch-logs';

describe('Mock AWS Services', () => {
  beforeEach(() => {
    MockAwsState.reset();
  });

  describe('CloudFormation', () => {
    it('creates a base stack with expected resources', () => {
      MockCloudFormation.createStack({
        StackName: 'test-base',
        TemplateBody: 'ECSCluster base stack',
      });

      const stack = MockAwsState.stacks.get('test-base');
      expect(stack).toBeDefined();
      expect(stack!.StackStatus).toBe('CREATE_COMPLETE');

      const resources = MockCloudFormation.describeStackResources({
        StackName: 'test-base',
      }).StackResources;
      const resourceIds = resources.map((r) => r.LogicalResourceId);

      expect(resourceIds).toContain('ECSCluster');
      expect(resourceIds).toContain('PublicSubnetOne');
      expect(resourceIds).toContain('PublicSubnetTwo');
      expect(resourceIds).toContain('ContainerSecurityGroup');
      expect(resourceIds).toContain('S3Bucket');
    });

    it('creates a job stack with task definition and kinesis stream', () => {
      MockCloudFormation.createStack({ StackName: 'test-job' });

      const resources = MockCloudFormation.describeStackResources({
        StackName: 'test-job',
      }).StackResources;
      const resourceIds = resources.map((r) => r.LogicalResourceId);

      expect(resourceIds).toContain('TaskDefinition');
      expect(resourceIds).toContain('KinesisStream');
      expect(resourceIds).toContain('LogGroup');
    });

    it('lists stacks', () => {
      MockCloudFormation.createStack({
        StackName: 'stack-a',
        TemplateBody: 'ECSCluster base stack',
      });
      MockCloudFormation.createStack({ StackName: 'stack-b' });

      const result = MockCloudFormation.listStacks();
      expect(result.StackSummaries).toHaveLength(2);
    });

    it('deletes a stack and cleans up resources', () => {
      MockCloudFormation.createStack({ StackName: 'to-delete' });
      expect(MockAwsState.kinesisStreams.size).toBe(1);

      MockCloudFormation.deleteStack({ StackName: 'to-delete' });
      const stack = MockAwsState.stacks.get('to-delete');
      expect(stack!.StackStatus).toBe('DELETE_COMPLETE');
    });

    it('throws when creating duplicate stack', () => {
      MockCloudFormation.createStack({ StackName: 'dup' });
      expect(() => MockCloudFormation.createStack({ StackName: 'dup' })).toThrow('already exists');
    });
  });

  describe('ECS', () => {
    it('runs a task and transitions through lifecycle', async () => {
      // Setup cluster
      MockCloudFormation.createStack({ StackName: 'base', TemplateBody: 'ECSCluster base stack' });
      const cluster = MockCloudFormation.describeStackResources({
        StackName: 'base',
      }).StackResources.find((r) => r.LogicalResourceId === 'ECSCluster')!.PhysicalResourceId;

      const result = await MockEcs.runTask({
        cluster,
        taskDefinition: 'arn:aws:ecs:eu-west-2:123:task-definition/test',
        overrides: {
          containerOverrides: [{ name: 'test', command: ['-c', 'echo hello'] }],
        },
      });

      expect(result.tasks).toHaveLength(1);
      const taskArn = result.tasks[0].taskArn;
      expect(taskArn).toContain('arn:aws:ecs');

      // Wait for lifecycle
      await MockEcs.waitUntilTasksRunning({ tasks: [taskArn], cluster });

      // Task should eventually stop
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const described = MockEcs.describeTasks({ cluster, tasks: [taskArn] });
      expect(described.tasks[0].lastStatus).toBe('STOPPED');
      expect(described.tasks[0].containers[0].exitCode).toBe(0);
    });

    it('lists clusters and tasks', () => {
      MockCloudFormation.createStack({ StackName: 'base', TemplateBody: 'ECSCluster base stack' });
      const clusters = MockEcs.listClusters();
      expect(clusters.clusterArns.length).toBeGreaterThan(0);
    });

    it('stops a task', async () => {
      MockCloudFormation.createStack({ StackName: 'base', TemplateBody: 'ECSCluster base stack' });
      const cluster = [...MockAwsState.ecsClusters.keys()][0];

      const result = await MockEcs.runTask({
        cluster,
        taskDefinition: 'test-def',
        overrides: { containerOverrides: [{ name: 'c', command: [] }] },
      });

      MockEcs.stopTask({ cluster, task: result.tasks[0].taskArn, reason: 'test stop' });
      const task = MockAwsState.ecsTasks.get(result.tasks[0].taskArn);
      expect(task!.lastStatus).toBe('STOPPED');
      expect(task!.stoppedReason).toBe('test stop');
    });
  });

  describe('S3', () => {
    it('put and list objects', () => {
      MockAwsState.s3Buckets.set('test-bucket', []);

      MockS3.putObject({ Bucket: 'test-bucket', Key: 'foo/bar.txt', Body: 'hello' });
      MockS3.putObject({ Bucket: 'test-bucket', Key: 'foo/baz.txt', Body: 'world' });
      MockS3.putObject({ Bucket: 'test-bucket', Key: 'other.txt', Body: 'x' });

      const all = MockS3.listObjectsV2({ Bucket: 'test-bucket' });
      expect(all.Contents).toHaveLength(3);

      const prefixed = MockS3.listObjectsV2({ Bucket: 'test-bucket', Prefix: 'foo/' });
      expect(prefixed.Contents).toHaveLength(2);
    });

    it('get and delete objects', () => {
      MockAwsState.s3Buckets.set('bucket', []);

      MockS3.putObject({ Bucket: 'bucket', Key: 'key', Body: 'data' });
      const obj = MockS3.getObject({ Bucket: 'bucket', Key: 'key' });
      expect(obj!.Body).toBe('data');

      MockS3.deleteObject({ Bucket: 'bucket', Key: 'key' });
      const deleted = MockS3.getObject({ Bucket: 'bucket', Key: 'key' });
      expect(deleted).toBeNull();
    });

    it('auto-creates bucket on put', () => {
      MockS3.putObject({ Bucket: 'auto-bucket', Key: 'k', Body: 'v' });
      expect(MockAwsState.s3Buckets.has('auto-bucket')).toBe(true);
    });
  });

  describe('Kinesis', () => {
    it('describes streams created by job stacks', () => {
      MockCloudFormation.createStack({ StackName: 'job-1' });
      const streamName = 'job-1-stream';

      const result = MockKinesis.describeStream({ StreamName: streamName });
      expect(result.StreamDescription.StreamName).toBe(streamName);
      expect(result.StreamDescription.Shards).toHaveLength(1);
    });

    it('reads records via iterator', () => {
      MockCloudFormation.createStack({ StackName: 'job-2' });
      const streamName = 'job-2-stream';

      const iter = MockKinesis.getShardIterator({
        StreamName: streamName,
        ShardId: 'shardId-000000000000',
        ShardIteratorType: 'TRIM_HORIZON',
      });

      // No records yet
      const empty = MockKinesis.getRecords({ ShardIterator: iter.ShardIterator });
      expect(empty.Records).toHaveLength(0);
    });
  });

  describe('CloudWatch Logs', () => {
    it('lists and deletes log groups', () => {
      MockCloudFormation.createStack({ StackName: 'job-a' });
      MockCloudFormation.createStack({ StackName: 'job-b' });

      const groups = MockCloudWatchLogs.describeLogGroups();
      expect(groups.logGroups).toHaveLength(2);

      MockCloudWatchLogs.deleteLogGroup({ logGroupName: groups.logGroups[0].logGroupName });
      expect(MockCloudWatchLogs.describeLogGroups().logGroups).toHaveLength(1);
    });
  });

  describe('State reset', () => {
    it('clears all state', () => {
      MockCloudFormation.createStack({ StackName: 'base', TemplateBody: 'ECSCluster base stack' });
      MockCloudFormation.createStack({ StackName: 'job' });
      MockS3.putObject({ Bucket: 'b', Key: 'k', Body: 'v' });

      expect(MockAwsState.stacks.size).toBe(2);
      expect(MockAwsState.s3Buckets.size).toBeGreaterThan(0);

      MockAwsState.reset();

      expect(MockAwsState.stacks.size).toBe(0);
      expect(MockAwsState.ecsClusters.size).toBe(0);
      expect(MockAwsState.ecsTasks.size).toBe(0);
      expect(MockAwsState.s3Buckets.size).toBe(0);
      expect(MockAwsState.logGroups.size).toBe(0);
      expect(MockAwsState.kinesisStreams.size).toBe(0);
    });
  });
});
