import { k8sTypes, k8s, core, yaml, waitUntil, http } from '../../../../dependencies.ts';
import Parameters from '../../../parameters.ts';
import CloudRunnerLogger from '../../services/cloud-runner-logger.ts';

class KubernetesStorage {
  public static async createPersistentVolumeClaim(
    buildParameters: Parameters,
    pvcName: string,
    kubeClient: k8sTypes.CoreV1Api,
    namespace: string,
  ) {
    if (buildParameters.kubeVolume) {
      CloudRunnerLogger.log(buildParameters.kubeVolume);
      pvcName = buildParameters.kubeVolume;

      return;
    }

    const listedPvcs = await kubeClient.listNamespacedPersistentVolumeClaim(namespace);
    const pvcList = listedPvcs.body.items.map((x) => x.metadata?.name);
    CloudRunnerLogger.log(`Current PVCs in namespace ${namespace}`);
    CloudRunnerLogger.log(JSON.stringify(pvcList, undefined, 4));
    if (pvcList.includes(pvcName)) {
      CloudRunnerLogger.log(`pvc ${pvcName} already exists`);
      if (!buildParameters.isCliMode) {
        core.setOutput('volume', pvcName);
      }

      return;
    }
    CloudRunnerLogger.log(`Creating PVC ${pvcName} (does not exist)`);
    const result = await KubernetesStorage.createPVC(pvcName, buildParameters, kubeClient, namespace);
    await KubernetesStorage.handleResult(result, kubeClient, namespace, pvcName);
  }

  public static async getPVCPhase(kubeClient: k8sTypes.CoreV1Api, name: string, namespace: string) {
    try {
      const pvc = await kubeClient.readNamespacedPersistentVolumeClaim(name, namespace);

      return pvc.body.status?.phase;
    } catch (error) {
      log.error('Failed to get PVC phase');
      log.error(JSON.stringify(error, undefined, 4));
      throw error;
    }
  }

  public static async watchUntilPVCNotPending(kubeClient: k8sTypes.CoreV1Api, name: string, namespace: string) {
    try {
      CloudRunnerLogger.log(`watch Until PVC Not Pending ${name} ${namespace}`);
      CloudRunnerLogger.log(`${await this.getPVCPhase(kubeClient, name, namespace)}`);
      await waitUntil(
        async () => {
          return (await this.getPVCPhase(kubeClient, name, namespace)) === 'Pending';
        },
        {
          timeout: 750_000,
          intervalBetweenAttempts: 15_000,
        },
      );
    } catch (error: any) {
      log.error('Failed to watch PVC');
      log.error(error.toString());
      const pvc = await kubeClient.readNamespacedPersistentVolumeClaim(name, namespace);
      log.error(`PVC Body: ${JSON.stringify(pvc.body, undefined, 4)}`);
      throw error;
    }
  }

  private static async createPVC(
    pvcName: string,
    buildParameters: Parameters,
    kubeClient: k8sTypes.CoreV1Api,
    namespace: string,
  ) {
    const pvc = new k8s.V1PersistentVolumeClaim();
    pvc.apiVersion = 'v1';
    pvc.kind = 'PersistentVolumeClaim';
    pvc.metadata = {
      name: pvcName,
    };
    pvc.spec = {
      accessModes: ['ReadWriteOnce'],
      storageClassName: buildParameters.kubeStorageClass === '' ? 'standard' : buildParameters.kubeStorageClass,
      resources: {
        requests: {
          storage: buildParameters.kubeVolumeSize,
        },
      },
    };
    if (Deno.env.get('K8s_STORAGE_PVC_SPEC')) {
      yaml.parse(Deno.env.get('K8s_STORAGE_PVC_SPEC'));
    }
    const result = await kubeClient.createNamespacedPersistentVolumeClaim(namespace, pvc);

    return result;
  }

  private static async handleResult(
    result: { response: http.IncomingMessage; body: k8s.V1PersistentVolumeClaim },
    kubeClient: k8sTypes.CoreV1Api,
    namespace: string,
    pvcName: string,
  ) {
    const name = result.body.metadata?.name || '';
    CloudRunnerLogger.log(`PVC ${name} created`);
    await this.watchUntilPVCNotPending(kubeClient, name, namespace);
    CloudRunnerLogger.log(`PVC ${name} is ready and not pending`);
    core.setOutput('volume', pvcName);
  }
}

export default KubernetesStorage;
