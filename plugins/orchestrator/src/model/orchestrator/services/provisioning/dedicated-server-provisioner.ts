/**
 * Dedicated-server provisioning artifacts.
 *
 * Orchestrator already decides *where* a job runs (see providers/: aws,
 * azure-aci, gcp-cloud-run, k8s, docker, local, ...). Shipping a server
 * build is the same question one step later - given this build, what does
 * it take to actually run it somewhere - so it belongs here rather than in
 * a standalone plugin.
 *
 * Everything in this module is a pure function from config to file
 * contents. Nothing is written to disk and nothing is executed: the caller
 * decides where the artifacts go, which keeps this testable and makes it
 * impossible for a generator bug to mutate a real host.
 */

export interface ServerPort {
  /** Port number on the host. */
  port: number;
  protocol: 'tcp' | 'udp';
  /** What this port is for, used as a comment in generated output. */
  description?: string;
}

export interface DedicatedServerConfig {
  /** Service name; used for the container, systemd unit and image tag. */
  name: string;
  /** Container image to run. */
  image: string;
  /** Ports the server listens on. */
  ports: ServerPort[];
  /** Environment variables passed to the server process. */
  environment?: Record<string, string>;
  /** Host path mounted for persistent state (save games, world data). */
  dataPath?: string;
  /** Command used by the health check, if the server exposes one. */
  healthCheckCommand?: string;
  /** Restart policy for both docker-compose and systemd. */
  restart?: 'no' | 'on-failure' | 'always';
  /** User the systemd unit runs as. Never root by default. */
  user?: string;
}

const DEFAULT_RESTART: NonNullable<DedicatedServerConfig['restart']> = 'on-failure';

/**
 * Game servers are overwhelmingly UDP, and a compose file that silently
 * publishes UDP ports as TCP produces a server that starts cleanly and is
 * simply unreachable - so the protocol is always written explicitly.
 */
function formatPort(port: ServerPort): string {
  return `"${port.port}:${port.port}/${port.protocol}"`;
}

function assertValidConfig(config: DedicatedServerConfig): void {
  if (!config.name.trim()) throw new Error('Dedicated server config requires a non-empty name.');
  if (!config.image.trim()) throw new Error(`Dedicated server "${config.name}" requires an image.`);
  if (config.ports.length === 0) {
    throw new Error(`Dedicated server "${config.name}" requires at least one port.`);
  }

  const seen = new Set<string>();
  for (const port of config.ports) {
    if (!Number.isInteger(port.port) || port.port < 1 || port.port > 65535) {
      throw new Error(`Dedicated server "${config.name}" has an out-of-range port: ${port.port}.`);
    }

    // The same number on tcp and udp is legitimate and common; the same
    // number twice on one protocol is a config bug that docker would only
    // surface at run time.
    const key = `${port.port}/${port.protocol}`;
    if (seen.has(key)) {
      throw new Error(`Dedicated server "${config.name}" declares ${key} more than once.`);
    }
    seen.add(key);
  }
}

/** Generates a docker-compose service definition for the server. */
export function generateDockerCompose(config: DedicatedServerConfig): string {
  assertValidConfig(config);

  const restart = config.restart ?? DEFAULT_RESTART;
  // compose has no 'on-failure' literal - it spells the same policy as
  // 'on-failure:<retries>'; 'no'/'always' pass through unchanged.
  const composeRestart = restart === 'on-failure' ? 'on-failure:3' : restart;

  const lines: string[] = [
    'services:',
    `  ${config.name}:`,
    `    image: ${config.image}`,
    `    container_name: ${config.name}`,
    `    restart: ${composeRestart}`,
    '    ports:',
    ...config.ports.map((port) => `      - ${formatPort(port)}`),
  ];

  const environment = config.environment ?? {};
  const environmentKeys = Object.keys(environment).sort();
  if (environmentKeys.length > 0) {
    lines.push('    environment:');
    for (const key of environmentKeys) {
      lines.push(`      ${key}: ${JSON.stringify(environment[key])}`);
    }
  }

  if (config.dataPath) {
    lines.push('    volumes:', `      - ${JSON.stringify(`${config.dataPath}:/data`)}`);
  }

  if (config.healthCheckCommand) {
    lines.push(
      '    healthcheck:',
      `      test: ${JSON.stringify(['CMD-SHELL', config.healthCheckCommand])}`,
      '      interval: 30s',
      '      timeout: 5s',
      '      retries: 3',
      // Cold-starting a game server (loading a world, warming caches) can
      // easily exceed the retry budget; start_period keeps those early
      // failures from being counted as unhealthy.
      '      start_period: 30s',
    );
  }

  return `${lines.join('\n')}\n`;
}

/** Generates a systemd unit that runs the server via docker. */
export function generateSystemdUnit(config: DedicatedServerConfig): string {
  assertValidConfig(config);

  const restart = config.restart ?? DEFAULT_RESTART;
  const publish = config.ports.map((port) => `-p ${port.port}:${port.port}/${port.protocol}`);
  const environment = config.environment ?? {};
  const environmentArguments = Object.keys(environment)
    .sort()
    .map((key) => `-e ${key}=${JSON.stringify(environment[key])}`);
  const volume = config.dataPath ? [`-v ${JSON.stringify(`${config.dataPath}:/data`)}`] : [];

  const runArguments = [
    'run',
    '--rm',
    `--name ${config.name}`,
    ...publish,
    ...environmentArguments,
    ...volume,
    config.image,
  ].join(' ');

  return [
    '[Unit]',
    `Description=${config.name} dedicated server`,
    // Without these, a reboot races the unit against dockerd and the server
    // fails to start until something restarts it manually.
    'After=network-online.target docker.service',
    'Wants=network-online.target',
    'Requires=docker.service',
    '',
    '[Service]',
    'Type=simple',
    `User=${config.user ?? config.name}`,
    `Restart=${restart}`,
    'RestartSec=5',
    // --rm plus a pre-stop cleanup keeps a crashed container from blocking
    // the next start with a name conflict.
    `ExecStartPre=-/usr/bin/docker rm -f ${config.name}`,
    `ExecStart=/usr/bin/docker ${runArguments}`,
    `ExecStop=/usr/bin/docker stop ${config.name}`,
    '',
    '[Install]',
    'WantedBy=multi-user.target',
    '',
  ].join('\n');
}

/** Generates the ufw commands needed to open the server's ports. */
export function generateFirewallRules(config: DedicatedServerConfig): string[] {
  assertValidConfig(config);

  return config.ports.map((port) => {
    const comment = port.description ? ` comment ${JSON.stringify(port.description)}` : '';

    return `ufw allow ${port.port}/${port.protocol}${comment}`;
  });
}
