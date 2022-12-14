import CloudRunnerLogger from '../../services/cloud-runner-logger.ts';
import { k8sTypes, k8s, Writable, waitUntil } from '../../../../dependencies.ts';
import { CloudRunnerStatics } from '../../cloud-runner-statics.ts';
import { FollowLogStreamService } from '../../services/follow-log-stream-service.ts';

class KubernetesTaskRunner {
  static async runTask(
    kubeConfig: k8sTypes.KubeConfig,
    kubeClient: k8sTypes.CoreV1Api,
    jobName: string,
    podName: string,
    containerName: string,
    namespace: string,
  ) {
    CloudRunnerLogger.log(`Streaming logs from pod: ${podName} container: ${containerName} namespace: ${namespace}`);
    const stream = new Writable();
    let output = '';
    let didStreamAnyLogs: boolean = false;
    let shouldReadLogs = true;
    let shouldCleanup = true;
    stream._write = (chunk, encoding, next) => {
      didStreamAnyLogs = true;
      let message = chunk.toString().trimRight(`\n`);
      message = `[${CloudRunnerStatics.logPrefix}] ${message}`;
      ({ shouldReadLogs, shouldCleanup, output } = FollowLogStreamService.handleIteration(
        message,
        shouldReadLogs,
        shouldCleanup,
        output,
      ));
      next();
    };
    const logOptions = {
      follow: true,
      pretty: false,
      previous: false,
    };
    try {
      const resultError = await new Promise((resolve) =>
        new k8s.Log(kubeConfig).log(namespace, podName, containerName, stream, resolve, logOptions),
      );
      stream.destroy();
      if (resultError) {
        throw resultError;
      }
      if (!didStreamAnyLogs) {
        log.error('Failed to stream any logs, listing namespace events, check for an error with the container');
        const listedEvents = await kubeClient.listNamespacedEvent(namespace);
        log.error(
          JSON.stringify(
            {
              events: listedEvents.body.items
                .filter((x) => {
                  return x.involvedObject.name === podName || x.involvedObject.name === jobName;
                })
                .map((x) => {
                  return {
                    type: x.involvedObject.kind,
                    name: x.involvedObject.name,
                    message: x.message,
                  };
                }),
            },
            undefined,
            4,
          ),
        );
        throw new Error(`No logs streamed from k8s`);
      }
    } catch (error) {
      if (stream) {
        stream.destroy();
      }
      throw error;
    }
    CloudRunnerLogger.log('end of log stream');

    return output;
  }

  static async watchUntilPodRunning(kubeClient: k8sTypes.CoreV1Api, podName: string, namespace: string) {
    let success: boolean = false;
    CloudRunnerLogger.log(`Watching ${podName} ${namespace}`);
    await waitUntil(
      async () => {
        const status = await kubeClient.readNamespacedPodStatus(podName, namespace);
        const phase = status?.body.status?.phase;
        success = phase === 'Running';
        CloudRunnerLogger.log(
          `${status.body.status?.phase} ${status.body.status?.conditions?.[0].reason || ''} ${
            status.body.status?.conditions?.[0].message || ''
          }`,
        );

        return success || phase !== 'Pending';
      },
      {
        timeout: 2_000_000,
        intervalBetweenAttempts: 15_000,
      },
    );

    return success;
  }
}

export default KubernetesTaskRunner;
