/**
 * In-memory state store for mock AWS services.
 *
 * Simulates CloudFormation stacks, ECS clusters/tasks, S3 buckets,
 * Kinesis streams, and CloudWatch log groups — enough to exercise
 * the full orchestrator AWS pipeline without MiniStack or real AWS.
 *
 * Designed to be corrected as drift from real AWS behavior is reported.
 */

export interface MockStack {
  StackName: string;
  StackStatus: string;
  TemplateDescription?: string;
  CreationTime: Date;
  Resources: MockStackResource[];
  Parameters?: Record<string, string>;
}

export interface MockStackResource {
  LogicalResourceId: string;
  PhysicalResourceId: string;
  ResourceType: string;
  ResourceStatus: string;
}

export interface MockEcsTask {
  taskArn: string;
  clusterArn: string;
  taskDefinitionArn: string;
  lastStatus: string;
  desiredStatus: string;
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
  stoppedReason?: string;
  containers: MockContainer[];
  overrides?: any;
}

export interface MockContainer {
  name: string;
  lastStatus: string;
  exitCode?: number;
  image?: string;
}

export interface MockS3Object {
  Key: string;
  Size: number;
  LastModified: Date;
  Body?: string;
}

export interface MockLogGroup {
  logGroupName: string;
  creationTime: number;
  retentionInDays?: number;
}

export interface MockKinesisStream {
  StreamName: string;
  StreamStatus: string;
  Shards: { ShardId: string }[];
  records: MockKinesisRecord[];
}

export interface MockKinesisRecord {
  Data: string; // base64 gzipped JSON, matching real Kinesis→CloudWatch format
  SequenceNumber: string;
  PartitionKey: string;
}

/**
 * Global in-memory AWS state — reset between tests via MockAwsState.reset().
 */
export class MockAwsState {
  static stacks: Map<string, MockStack> = new Map();
  static ecsClusters: Map<string, string[]> = new Map(); // clusterArn → taskArns
  static ecsTasks: Map<string, MockEcsTask> = new Map(); // taskArn → task
  static s3Buckets: Map<string, MockS3Object[]> = new Map(); // bucket → objects
  static logGroups: Map<string, MockLogGroup> = new Map(); // name → group
  static kinesisStreams: Map<string, MockKinesisStream> = new Map(); // name → stream

  private static counter = 0;

  static generateArn(service: string, resource: string): string {
    MockAwsState.counter++;
    return `arn:aws:${service}:eu-west-2:123456789012:${resource}/${MockAwsState.counter}`;
  }

  static generatePhysicalId(prefix: string): string {
    MockAwsState.counter++;
    return `${prefix}-${MockAwsState.counter}-mock`;
  }

  static reset(): void {
    MockAwsState.stacks.clear();
    MockAwsState.ecsClusters.clear();
    MockAwsState.ecsTasks.clear();
    MockAwsState.s3Buckets.clear();
    MockAwsState.logGroups.clear();
    MockAwsState.kinesisStreams.clear();
    MockAwsState.counter = 0;
  }
}
