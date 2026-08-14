/**
 * Mock S3 service.
 *
 * Simulates bucket operations used by the orchestrator:
 * ListObjectsV2, PutObject, GetObject, DeleteObject.
 */

import { MockAwsState, MockS3Object } from './mock-aws-state';
import OrchestratorLogger from '../../services/core/orchestrator-logger';

export class MockS3 {
  /** List objects in a bucket. */
  static listObjectsV2(params: { Bucket: string; Prefix?: string; ContinuationToken?: string }): {
    Contents: Array<{ Key: string; Size: number; LastModified: Date }>;
    IsTruncated: boolean;
    NextContinuationToken?: string;
  } {
    const objects = MockAwsState.s3Buckets.get(params.Bucket) || [];
    const filtered = params.Prefix
      ? objects.filter((o) => o.Key.startsWith(params.Prefix!))
      : objects;

    return {
      Contents: filtered.map((o) => ({
        Key: o.Key,
        Size: o.Size,
        LastModified: o.LastModified,
      })),
      IsTruncated: false,
    };
  }

  /** Put an object into a bucket. */
  static putObject(params: { Bucket: string; Key: string; Body: string }): void {
    const objects = MockAwsState.s3Buckets.get(params.Bucket);
    if (!objects) {
      // Auto-create bucket
      MockAwsState.s3Buckets.set(params.Bucket, []);
    }
    const bucket = MockAwsState.s3Buckets.get(params.Bucket)!;

    // Upsert
    const existing = bucket.findIndex((o) => o.Key === params.Key);
    const obj: MockS3Object = {
      Key: params.Key,
      Size: params.Body.length,
      LastModified: new Date(),
      Body: params.Body,
    };

    if (existing >= 0) {
      bucket[existing] = obj;
    } else {
      bucket.push(obj);
    }

    OrchestratorLogger.log(
      `[mock-aws] S3 PutObject: s3://${params.Bucket}/${params.Key} (${obj.Size} bytes)`,
    );
  }

  /** Get an object from a bucket. */
  static getObject(params: {
    Bucket: string;
    Key: string;
  }): { Body: string; ContentLength: number } | null {
    const bucket = MockAwsState.s3Buckets.get(params.Bucket);
    if (!bucket) return null;

    const obj = bucket.find((o) => o.Key === params.Key);
    if (!obj) return null;

    return { Body: obj.Body || '', ContentLength: obj.Size };
  }

  /** Delete an object from a bucket. */
  static deleteObject(params: { Bucket: string; Key: string }): void {
    const bucket = MockAwsState.s3Buckets.get(params.Bucket);
    if (!bucket) return;

    const idx = bucket.findIndex((o) => o.Key === params.Key);
    if (idx >= 0) {
      bucket.splice(idx, 1);
      OrchestratorLogger.log(`[mock-aws] S3 DeleteObject: s3://${params.Bucket}/${params.Key}`);
    }
  }
}
