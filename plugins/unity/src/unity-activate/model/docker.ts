import ImageTag from './image-tag';
import { exec } from '@actions/exec';

const Docker = {
  async build(buildParameters, silent = false) {
    const { path, dockerfile, baseImage } = buildParameters;
    const { version } = baseImage;

    const tag = new ImageTag(version);
    const command = `docker build ${path} \
      --file ${dockerfile} \
      --build-arg IMAGE=${baseImage} \
      --tag ${tag}`;

    await exec(command, undefined, { silent });

    return tag;
  },

  /**
   * `docker run` pulls an uncached image implicitly, but that folds the pull
   * time into the same session as Unity's license activation inside the
   * container - and these images are huge (7-8GB+ for Windows tags). A
   * partial cache miss can take 15+ minutes to pull, which is long enough
   * for Unity's own ephemeral license session to fail to return cleanly once
   * the container finally gets to run - a real failure, but one caused by
   * pull time eating into the license window, not by anything about
   * activation itself. Pulling explicitly first, before that window opens,
   * avoids the whole class of failure. A pull failure here is a real,
   * non-retryable-by-us problem (bad tag, registry down) and is left to fail
   * with Docker's own error rather than swallowed.
   */
  async pull(image) {
    await exec('docker', ['pull', String(image)]);
  },

  async run(image, parameters, silent = false) {
    const { unityVersion, workspace } = parameters;

    await this.pull(image);

    const command = `docker run \
        --workdir /github/workspace \
        --rm \
        --env UNITY_LICENSE \
        --env UNITY_EMAIL \
        --env UNITY_PASSWORD \
        --env UNITY_SERIAL \
        --env UNITY_VERSION=${unityVersion} \
        --env HOME=/github/home \
        --env GITHUB_REF \
        --env GITHUB_SHA \
        --env GITHUB_REPOSITORY \
        --env GITHUB_ACTOR \
        --env GITHUB_WORKFLOW \
        --env GITHUB_HEAD_REF \
        --env GITHUB_BASE_REF \
        --env GITHUB_EVENT_NAME \
        --env GITHUB_WORKSPACE=/github/workspace \
        --env GITHUB_ACTION \
        --env GITHUB_EVENT_PATH \
        --env RUNNER_OS \
        --env RUNNER_TOOL_CACHE \
        --env RUNNER_TEMP \
        --env RUNNER_WORKSPACE \
        --volume "/var/run/docker.sock":"/var/run/docker.sock" \
        --volume "/home/runner/work/_temp/_github_home":"/github/home" \
        --volume "/home/runner/work/_temp/_github_workflow":"/github/workflow" \
        --volume "${workspace}":"/github/workspace" \
        ${image}`;

    await exec(command, undefined, { silent });
  },
};

export default Docker;
