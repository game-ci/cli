/**
 * Service directory for exposed job endpoints.
 *
 * When orchestrator runs a job somewhere other than the developer's
 * machine (any of providers/), anything that job serves - a dev build, a
 * profiler endpoint, a dedicated server - needs a resolvable address before
 * it is useful to a human. That is a property of the running job, so it
 * belongs next to hot-runner and the providers rather than in a standalone
 * plugin.
 *
 * This module owns the *registry and its disclosure rules*, not the tunnel
 * transport. It never starts a tunnel process: a caller resolves a URL
 * however it likes (cloudflared, ngrok, a LAN address, a k8s Service) and
 * registers it here.
 *
 * The disclosure rule is the point. An ephemeral tunnel URL is an
 * unauthenticated public entry point into a machine that is often mid-build
 * with source and credentials on disk, and CI logs are frequently public or
 * archived. So visibility is explicit per service, defaults to private, and
 * a private URL is redacted by `formatForLog` rather than printed.
 */

export type ServiceVisibility = 'public' | 'private';

export interface ServiceEntry {
  /** Stable identifier, unique within the directory. */
  name: string;
  /** Fully-qualified URL the service is reachable at. */
  url: string;
  /**
   * 'public' means the URL may appear in logs and CI output. 'private'
   * means it is redacted - the service may still be reachable, this
   * controls disclosure only, never access.
   */
  visibility: ServiceVisibility;
  /** Free-form description shown alongside the entry. */
  description?: string;
}

export class ServiceDirectoryError extends Error {}

/**
 * Ephemeral tunnels are frequently plain http; that is allowed but the
 * value still has to be a real absolute URL, since a half-formed address
 * is worse than none (it looks published but resolves nowhere).
 */
function assertValidUrl(name: string, url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ServiceDirectoryError(
      `Service "${name}" has an invalid URL: ${JSON.stringify(url)}.`,
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ServiceDirectoryError(
      `Service "${name}" must use http or https, got ${JSON.stringify(parsed.protocol)}.`,
    );
  }
}

export class ServiceDirectory {
  private readonly entries = new Map<string, ServiceEntry>();

  /**
   * Registers a service.
   *
   * `visibility` is required rather than defaulted at the call site, so
   * publishing a URL is always a deliberate decision - an omitted argument
   * cannot quietly make a tunnel public.
   */
  register(entry: ServiceEntry): void {
    if (!entry.name.trim()) throw new ServiceDirectoryError('Service name must not be empty.');
    assertValidUrl(entry.name, entry.url);

    if (this.entries.has(entry.name)) {
      throw new ServiceDirectoryError(
        `Service "${entry.name}" is already registered; use replace() to update it.`,
      );
    }

    this.entries.set(entry.name, { ...entry });
  }

  /** Registers or overwrites a service. */
  replace(entry: ServiceEntry): void {
    this.entries.delete(entry.name);
    this.register(entry);
  }

  get(name: string): ServiceEntry | undefined {
    const entry = this.entries.get(name);

    return entry ? { ...entry } : undefined;
  }

  list(): ServiceEntry[] {
    return [...this.entries.values()]
      .map((entry) => ({ ...entry }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Only the entries explicitly marked public. */
  listPublic(): ServiceEntry[] {
    return this.list().filter((entry) => entry.visibility === 'public');
  }

  /**
   * Renders the directory for a build log, redacting private URLs.
   *
   * Redaction replaces the whole URL, not just the host: an ephemeral
   * tunnel's random subdomain *is* the secret, so a partially-masked URL
   * would still leak the reachable address.
   */
  formatForLog(): string {
    const entries = this.list();
    if (entries.length === 0) return 'No services registered.';

    return entries
      .map((entry) => {
        const url = entry.visibility === 'public' ? entry.url : '<redacted: private service>';
        const description = entry.description ? ` - ${entry.description}` : '';

        return `${entry.name}: ${url}${description}`;
      })
      .join('\n');
  }
}
