import { describe, it, expect } from 'vitest';
import {
  generateDockerCompose,
  generateSystemdUnit,
  generateFirewallRules,
  DedicatedServerConfig,
} from './dedicated-server-provisioner';

const baseConfig: DedicatedServerConfig = {
  name: 'my-game-server',
  image: 'ghcr.io/example/my-game-server:1.2.3',
  ports: [
    { port: 27015, protocol: 'udp', description: 'Game traffic' },
    { port: 27016, protocol: 'tcp', description: 'RCON' },
  ],
};

describe('generateDockerCompose', () => {
  it('publishes each port with its explicit protocol', () => {
    const compose = generateDockerCompose(baseConfig);

    // A UDP game port silently published as TCP produces a server that
    // starts fine and is simply unreachable.
    expect(compose).toContain('- "27015:27015/udp"');
    expect(compose).toContain('- "27016:27016/tcp"');
  });

  it("translates on-failure into compose's retry-count form", () => {
    expect(generateDockerCompose(baseConfig)).toContain('restart: on-failure:3');
    expect(generateDockerCompose({ ...baseConfig, restart: 'always' })).toContain(
      'restart: always',
    );
  });

  it('emits environment and volume entries when configured', () => {
    const compose = generateDockerCompose({
      ...baseConfig,
      environment: { MAX_PLAYERS: '32', SERVER_NAME: 'Test Server' },
      dataPath: '/srv/game/data',
    });

    expect(compose).toContain('MAX_PLAYERS: "32"');
    // Quoted so a value with spaces survives YAML parsing.
    expect(compose).toContain('SERVER_NAME: "Test Server"');
    expect(compose).toContain('- "/srv/game/data:/data"');
  });

  it('gives the health check a start period so slow world loads are not failures', () => {
    const compose = generateDockerCompose({
      ...baseConfig,
      healthCheckCommand: 'curl -f localhost:8080/health',
    });

    expect(compose).toContain('healthcheck:');
    expect(compose).toContain('start_period: 30s');
  });

  it('omits the healthcheck block entirely when no command is given', () => {
    expect(generateDockerCompose(baseConfig)).not.toContain('healthcheck:');
  });
});

describe('generateSystemdUnit', () => {
  it('orders the unit after docker so a reboot does not race the daemon', () => {
    const unit = generateSystemdUnit(baseConfig);

    expect(unit).toContain('After=network-online.target docker.service');
    expect(unit).toContain('Requires=docker.service');
  });

  it('removes a stale container before starting, so a crash cannot block the next start', () => {
    expect(generateSystemdUnit(baseConfig)).toContain(
      'ExecStartPre=-/usr/bin/docker rm -f my-game-server',
    );
  });

  it('does not run as root by default', () => {
    expect(generateSystemdUnit(baseConfig)).toContain('User=my-game-server');
    expect(generateSystemdUnit({ ...baseConfig, user: 'gameuser' })).toContain('User=gameuser');
  });

  it('publishes every port on the docker run line', () => {
    const unit = generateSystemdUnit(baseConfig);

    expect(unit).toContain('-p 27015:27015/udp');
    expect(unit).toContain('-p 27016:27016/tcp');
  });
});

describe('generateFirewallRules', () => {
  it('opens each port with its protocol and description', () => {
    expect(generateFirewallRules(baseConfig)).toEqual([
      'ufw allow 27015/udp comment "Game traffic"',
      'ufw allow 27016/tcp comment "RCON"',
    ]);
  });
});

describe('validation', () => {
  it('rejects a config with no ports', () => {
    expect(() => generateDockerCompose({ ...baseConfig, ports: [] })).toThrow(/at least one port/i);
  });

  it('rejects an out-of-range port', () => {
    expect(() =>
      generateDockerCompose({ ...baseConfig, ports: [{ port: 70000, protocol: 'tcp' }] }),
    ).toThrow(/out-of-range/i);
  });

  it('rejects the same port twice on one protocol', () => {
    expect(() =>
      generateDockerCompose({
        ...baseConfig,
        ports: [
          { port: 27015, protocol: 'udp' },
          { port: 27015, protocol: 'udp' },
        ],
      }),
    ).toThrow(/more than once/i);
  });

  it('allows the same port number on tcp and udp, which is legitimate', () => {
    expect(() =>
      generateDockerCompose({
        ...baseConfig,
        ports: [
          { port: 27015, protocol: 'udp' },
          { port: 27015, protocol: 'tcp' },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects an empty image or name', () => {
    expect(() => generateDockerCompose({ ...baseConfig, image: '' })).toThrow(/image/i);
    expect(() => generateDockerCompose({ ...baseConfig, name: '  ' })).toThrow(/name/i);
  });
});
