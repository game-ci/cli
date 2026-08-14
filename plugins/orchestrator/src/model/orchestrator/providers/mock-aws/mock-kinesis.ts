/**
 * Mock Kinesis service.
 *
 * Simulates the Kinesis stream that real AWS uses to deliver
 * CloudWatch log events from ECS tasks. Produces gzipped base64
 * records in the same format as CloudWatch Logs subscription filters.
 */

import * as zlib from 'node:zlib';
import { MockAwsState, MockKinesisRecord } from './mock-aws-state';
import OrchestratorLogger from '../../services/core/orchestrator-logger';

export class MockKinesis {
  /** Describe a Kinesis stream. */
  static describeStream(params: { StreamName: string }): {
    StreamDescription: {
      StreamName: string;
      StreamStatus: string;
      Shards: { ShardId: string }[];
    };
  } {
    const stream = MockAwsState.kinesisStreams.get(params.StreamName);
    if (!stream) {
      throw new Error(`Stream ${params.StreamName} not found`);
    }
    return {
      StreamDescription: {
        StreamName: stream.StreamName,
        StreamStatus: stream.StreamStatus,
        Shards: stream.Shards,
      },
    };
  }

  /** Get a shard iterator. */
  static getShardIterator(params: {
    StreamName: string;
    ShardId: string;
    ShardIteratorType: string;
  }): { ShardIterator: string } {
    // Encode the stream name + position into the iterator
    return {
      ShardIterator: `mock-iterator:${params.StreamName}:0`,
    };
  }

  /** Get records from a shard. */
  static getRecords(params: { ShardIterator: string }): {
    Records: MockKinesisRecord[];
    NextShardIterator: string;
    MillisBehindLatest: number;
  } {
    const parts = params.ShardIterator.split(':');
    const streamName = parts[1];
    const position = parseInt(parts[2] || '0', 10);

    const stream = MockAwsState.kinesisStreams.get(streamName);
    if (!stream) {
      return {
        Records: [],
        NextShardIterator: params.ShardIterator,
        MillisBehindLatest: 0,
      };
    }

    // Return unread records
    const newRecords = stream.records.slice(position);
    const nextPosition = stream.records.length;

    return {
      Records: newRecords,
      NextShardIterator: `mock-iterator:${streamName}:${nextPosition}`,
      MillisBehindLatest: newRecords.length > 0 ? 100 : 0,
    };
  }
}

/**
 * Helper to produce log records in the same format as CloudWatch Logs
 * subscription filters deliver to Kinesis.
 */
export class MockKinesisProducer {
  /** Produce mock log output for a simulated ECS task. */
  static produceTaskLogs(taskArn: string, commandStr: string): void {
    // Find any active Kinesis stream to push logs to
    for (const [, stream] of MockAwsState.kinesisStreams) {
      const logLines = [
        `[game-ci] Mock AWS task started: ${taskArn}`,
        `[game-ci] Executing: ${commandStr}`,
        `[game-ci] Build output simulated successfully`,
        `[game-ci] Mock AWS task completed`,
      ];

      const logEvents = logLines.map((message, i) => ({
        id: `${Date.now()}-${i}`,
        timestamp: Date.now() + i * 100,
        message,
      }));

      // Create CloudWatch Logs subscription filter format
      const payload = {
        messageType: 'DATA_MESSAGE',
        owner: '123456789012',
        logGroup: 'mock-log-group',
        logStream: `ecs/game-ci/${taskArn.split('/').pop()}`,
        subscriptionFilters: ['mock-filter'],
        logEvents,
      };

      // Gzip and base64 encode (matching real Kinesis format)
      const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(payload)));
      const record: MockKinesisRecord = {
        Data: compressed.toString('base64'),
        SequenceNumber: `${Date.now()}`,
        PartitionKey: 'mock',
      };

      stream.records.push(record);
      OrchestratorLogger.log(
        `[mock-aws] Produced ${logLines.length} log records to Kinesis stream ${stream.StreamName}`,
      );
      break; // Only push to first stream
    }
  }
}
