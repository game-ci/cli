/**
 * Mock CloudWatch Logs service.
 *
 * Simulates DescribeLogGroups and DeleteLogGroup operations
 * used by the orchestrator's TaskService and GarbageCollectionService.
 */

import { MockAwsState } from './mock-aws-state';
import OrchestratorLogger from '../../services/core/orchestrator-logger';

export class MockCloudWatchLogs {
  /** Describe log groups (with optional pagination). */
  static describeLogGroups(params?: { logGroupNamePrefix?: string; nextToken?: string }): {
    logGroups: Array<{
      logGroupName: string;
      creationTime: number;
      retentionInDays?: number;
    }>;
    nextToken?: string;
  } {
    let groups = [...MockAwsState.logGroups.values()];

    if (params?.logGroupNamePrefix) {
      groups = groups.filter((g) => g.logGroupName.startsWith(params.logGroupNamePrefix!));
    }

    return { logGroups: groups };
  }

  /** Delete a log group. */
  static deleteLogGroup(params: { logGroupName: string }): void {
    if (MockAwsState.logGroups.has(params.logGroupName)) {
      MockAwsState.logGroups.delete(params.logGroupName);
      OrchestratorLogger.log(`[mock-aws] DeleteLogGroup: ${params.logGroupName}`);
    }
  }
}
