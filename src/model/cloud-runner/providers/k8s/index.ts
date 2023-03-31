import { Parameters, Output } from '../../../index.ts';
import { k8sTypes, k8s, waitUntil } from '../../../../dependencies.ts';
import { ProviderInterface } from '../provider-interface.ts';
import CloudRunnerSecret from '../../services/cloud-runner-secret.ts';
import KubernetesStorage from './kubernetes-storage.ts';
import CloudRunnerEnvironmentVariable from '../../services/cloud-runner-environment-variable.ts';
import KubernetesTaskRunner from './kubernetes-task-runner.ts';
import KubernetesSecret from './kubernetes-secret.ts';
import KubernetesJobSpecFactory from './kubernetes-job-spec-factory.ts';
import KubernetesServiceAccount from './kubernetes-service-account.ts';
import CloudRunnerLogger from '../../services/cloud-runner-logger.ts';
import DependencyOverrideService from '../../services/depdency-override-service.ts';
import "../../../../global.d.ts";

class Kubernetes implements ProviderInterface {
  private kubeConfig: k8sTypes.KubeConfig;
  private kubeClient: k8sTypes.CoreV1Api;
  private kubeClientBatch: k8sTypes.BatchV1Api;
  private buildGuid: string = '';
  private buildParameters: Parameters;
  private pvcName: string = '';
  private secretName: string = '';
  private jobName: string = '';
  private namespace: string;
  private podName: string = '';
  private containerName: string = '';
  private cleanupCronJobName: string = '';
  private serviceAccountName: string = '';

  constructor(buildParameters: Parameters) {
    this.kubeConfig = new k8s.KubeConfig();
    this.kubeConfig.loadFromDefault();
    this.kubeClient = this.kubeConfig.makeApiClient(k8sTypes.CoreV1Api);
    this.kubeClientBatch = this.kubeConfig.makeApiClient(k8s.BatchV1Api);
    CloudRunnerLogger.log('Loaded default Kubernetes configuration for this environment');

    this.namespace = 'default';
    this.buildParameters = buildParameters;
  }
  public async setup(
    buildGuid: string,
    buildParameters: Parameters,
    branchName: string,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    try {
      this.pvcName = `unity-builder-pvc-${buildGuid}`;
      this.cleanupCronJobName = `unity-builder-cronjob-${buildGuid}`;
      this.serviceAccountName = `service-account-${buildGuid}`;
      if (await DependencyOverrideService.CheckHealth()) {
        await DependencyOverrideService.TryStartDependencies();
      }
      await KubernetesStorage.createPersistentVolumeClaim(
        buildParameters,
        this.pvcName,
        this.kubeClient,
        this.namespace,
      );

      await KubernetesServiceAccount.createServiceAccount(this.serviceAccountName, this.namespace, this.kubeClient);
    } catch (error) {
      throw error;
    }
  }

  async runTask(
    buildGuid: string,
    image: string,
    commands: string,
    mountdir: string,
    workingdir: string,
    environment: CloudRunnerEnvironmentVariable[],
    secrets: CloudRunnerSecret[],
  ): Promise<string> {
    try {
      // Setup
      this.buildGuid = buildGuid;
      this.secretName = `build-credentials-${buildGuid}`;
      this.jobName = `unity-builder-job-${buildGuid}`;
      this.containerName = `main`;
      await KubernetesSecret.createSecret(secrets, this.secretName, this.namespace, this.kubeClient);
      const jobSpec = KubernetesJobSpecFactory.getJobSpec(
        commands,
        image,
        mountdir,
        workingdir,
        environment,
        secrets,
        this.buildGuid,
        this.buildParameters,
        this.secretName,
        this.pvcName,
        this.jobName,
        k8s,
      );

      // Run
      const jobResult = await this.kubeClientBatch.createNamespacedJob(this.namespace, jobSpec);
      CloudRunnerLogger.log(`Creating build job ${JSON.stringify(jobResult.body.metadata, undefined, 4)}`);

      await new Promise((promise) => setTimeout(promise, 5000));
      CloudRunnerLogger.log('Job created');
      this.setPodNameAndContainerName(await Kubernetes.findPodFromJob(this.kubeClient, this.jobName, this.namespace));
      CloudRunnerLogger.log('Watching pod until running');
      let output = '';
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          await KubernetesTaskRunner.watchUntilPodRunning(this.kubeClient, this.podName, this.namespace);
          CloudRunnerLogger.log('Pod running, streaming logs');
          output = await KubernetesTaskRunner.runTask(
            this.kubeConfig,
            this.kubeClient,
            this.jobName,
            this.podName,
            'main',
            this.namespace,
          );
          break;
        } catch (error: any) {
          if (!error.message.includes(`HTTP`)) {
            throw error;
          }
        }
      }
      await this.cleanupTaskResources();

      return output;
    } catch (error) {
      CloudRunnerLogger.log('Running job failed');
      log.error(JSON.stringify(error, undefined, 4));
      await this.cleanupTaskResources();
      throw error;
    }
  }

  setPodNameAndContainerName(pod: k8s.V1Pod) {
    this.podName = pod.metadata?.name || '';
    this.containerName = pod.status?.containerStatuses?.[0].name || '';
  }

  async cleanupTaskResources() {
    CloudRunnerLogger.log('cleaning up');
    try {
      await this.kubeClientBatch.deleteNamespacedJob(this.jobName, this.namespace);
      await this.kubeClient.deleteNamespacedPod(this.podName, this.namespace);
      await this.kubeClient.deleteNamespacedSecret(this.secretName, this.namespace);
      await new Promise((promise) => setTimeout(promise, 5000));
    } catch (error) {
      CloudRunnerLogger.log('Failed to cleanup, error:');
      log.error(JSON.stringify(error, undefined, 4));
      CloudRunnerLogger.log('Abandoning cleanup, build error:');
      throw error;
    }
    try {
      await waitUntil(
        async () => {
          const { body: jobBody } = await this.kubeClientBatch.readNamespacedJob(this.jobName, this.namespace);
          const { body: podBody } = await this.kubeClient.readNamespacedPod(this.podName, this.namespace);

          return (jobBody === null || jobBody.status?.active === 0) && podBody === null;
        },
        {
          timeout: 500_000,
          intervalBetweenAttempts: 15_000,
        },
      );
    } catch {
      log.debug('Moved into empty catch block');
    }
  }

  async cleanup(
    buildGuid: string,
    buildParameters: Parameters,
    branchName: string,
    defaultSecretsArray: { ParameterKey: string; EnvironmentVariable: string; ParameterValue: string }[],
  ) {
    CloudRunnerLogger.log(`deleting PVC`);
    await this.kubeClient.deleteNamespacedPersistentVolumeClaim(this.pvcName, this.namespace);
    await Output.setBuildVersion(buildParameters.buildVersion);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit();
  }

  static async findPodFromJob(kubeClient: k8sTypes.CoreV1Api, jobName: string, namespace: string) {
    const namespacedPods = await kubeClient.listNamespacedPod(namespace);
    const pod = namespacedPods.body.items.find((x) => x.metadata?.labels?.['job-name'] === jobName);
    if (pod === undefined) {
      throw new Error("pod with job-name label doesn't exist");
    }

    return pod;
  }
}
export default Kubernetes;
