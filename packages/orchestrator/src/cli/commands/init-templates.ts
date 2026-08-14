interface InitConfig {
  provider: string;
  platform: string;
  workflowType: string;
  engine: string;
}

export function generateGitHubCIWorkflow(config: InitConfig): string {
  return `name: Game CI Build

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch: {}

jobs:
  build:
    name: Build \${{ matrix.targetPlatform }}
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        targetPlatform:
          - ${config.platform}
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true

      - uses: game-ci/unity-builder@v4
        env:
          UNITY_EMAIL: \${{ secrets.UNITY_EMAIL }}
          UNITY_PASSWORD: \${{ secrets.UNITY_PASSWORD }}
          UNITY_SERIAL: \${{ secrets.UNITY_SERIAL }}
        with:
          targetPlatform: \${{ matrix.targetPlatform }}
          providerStrategy: ${config.provider}
`;
}

export function generateGitHubCDWorkflow(config: InitConfig): string {
  return `name: Game CI Build & Deploy

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch: {}

jobs:
  build:
    name: Build \${{ matrix.targetPlatform }}
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        targetPlatform:
          - ${config.platform}
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true

      - uses: game-ci/unity-builder@v4
        id: build
        env:
          UNITY_EMAIL: \${{ secrets.UNITY_EMAIL }}
          UNITY_PASSWORD: \${{ secrets.UNITY_PASSWORD }}
          UNITY_SERIAL: \${{ secrets.UNITY_SERIAL }}
        with:
          targetPlatform: \${{ matrix.targetPlatform }}
          providerStrategy: ${config.provider}

      - uses: actions/upload-artifact@v4
        with:
          name: Build-\${{ matrix.targetPlatform }}
          path: build/\${{ matrix.targetPlatform }}
`;
}

export function generateGitHubAsyncWorkflow(config: InitConfig): string {
  return `name: Game CI Async Build

on:
  push:
    branches: [main]
  workflow_dispatch: {}

jobs:
  build:
    name: Async Build \${{ matrix.targetPlatform }}
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        targetPlatform:
          - ${config.platform}
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true

      - uses: game-ci/unity-builder@v4
        env:
          UNITY_EMAIL: \${{ secrets.UNITY_EMAIL }}
          UNITY_PASSWORD: \${{ secrets.UNITY_PASSWORD }}
          UNITY_SERIAL: \${{ secrets.UNITY_SERIAL }}
        with:
          targetPlatform: \${{ matrix.targetPlatform }}
          providerStrategy: ${config.provider}
          asyncWorkflow: 'true'
`;
}

export function generateGitLabCI(config: InitConfig): string {
  return `image: unityci/editor:ubuntu-2021.3.0f1-\${TARGET_PLATFORM}-3

variables:
  TARGET_PLATFORM: "${config.platform}"
  BUILD_NAME: "\${TARGET_PLATFORM}"
  BUILD_PATH: "./build"
  UNITY_DIR: "\${CI_PROJECT_DIR}"

stages:
  - build

build:
  stage: build
  script:
    - unity-editor \\
        -projectPath "\${UNITY_DIR}" \\
        -buildTarget "\${TARGET_PLATFORM}" \\
        -customBuildPath "\${BUILD_PATH}/\${BUILD_NAME}" \\
        -customBuildName "\${BUILD_NAME}" \\
        -logFile /dev/stdout \\
        -quit \\
        -batchmode \\
        -nographics
  artifacts:
    paths:
      - "\${BUILD_PATH}/"
    expire_in: 14 days
  tags:
    - docker
`;
}

export const templateGenerators: Record<string, Record<string, (config: InitConfig) => string>> = {
  github: {
    ci: generateGitHubCIWorkflow,
    cd: generateGitHubCDWorkflow,
    async: generateGitHubAsyncWorkflow,
  },
  gitlab: {
    ci: generateGitLabCI,
    cd: generateGitLabCI,
    async: generateGitLabCI,
  },
};
