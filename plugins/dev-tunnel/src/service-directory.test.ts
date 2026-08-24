import { describe, it, expect } from 'vitest';
import { ServiceDirectory, ServiceDirectoryError } from './service-directory';

describe('ServiceDirectory', () => {
  it('registers and returns a service', () => {
    const directory = new ServiceDirectory();
    directory.register({
      name: 'devbuild',
      url: 'https://abc123.trycloudflare.com',
      visibility: 'public',
    });

    expect(directory.get('devbuild')?.url).toBe('https://abc123.trycloudflare.com');
  });

  it('rejects a duplicate registration rather than silently overwriting', () => {
    const directory = new ServiceDirectory();
    directory.register({ name: 'devbuild', url: 'https://a.example.com', visibility: 'private' });

    expect(() =>
      directory.register({ name: 'devbuild', url: 'https://b.example.com', visibility: 'private' }),
    ).toThrow(ServiceDirectoryError);
  });

  it('replace() updates an existing entry', () => {
    const directory = new ServiceDirectory();
    directory.register({ name: 'devbuild', url: 'https://a.example.com', visibility: 'private' });
    directory.replace({ name: 'devbuild', url: 'https://b.example.com', visibility: 'public' });

    expect(directory.get('devbuild')?.url).toBe('https://b.example.com');
    expect(directory.get('devbuild')?.visibility).toBe('public');
  });

  it('rejects a malformed or non-http URL', () => {
    const directory = new ServiceDirectory();

    expect(() =>
      directory.register({ name: 'a', url: 'not a url', visibility: 'private' }),
    ).toThrow(/invalid URL/i);
    expect(() =>
      directory.register({ name: 'b', url: 'ftp://example.com', visibility: 'private' }),
    ).toThrow(/http or https/i);
  });

  it('returns copies, so a caller cannot mutate the directory through them', () => {
    const directory = new ServiceDirectory();
    directory.register({ name: 'devbuild', url: 'https://a.example.com', visibility: 'private' });

    const entry = directory.get('devbuild')!;
    entry.visibility = 'public';

    // A leaked reference here would let a caller flip a private service
    // public without going through register/replace.
    expect(directory.get('devbuild')?.visibility).toBe('private');
  });

  it('listPublic returns only explicitly public services', () => {
    const directory = new ServiceDirectory();
    directory.register({ name: 'public-one', url: 'https://a.example.com', visibility: 'public' });
    directory.register({
      name: 'private-one',
      url: 'https://b.example.com',
      visibility: 'private',
    });

    expect(directory.listPublic().map((entry) => entry.name)).toEqual(['public-one']);
  });

  describe('formatForLog', () => {
    it('redacts the whole private URL, not just its host', () => {
      const directory = new ServiceDirectory();
      directory.register({
        name: 'profiler',
        url: 'https://secret-sub.trycloudflare.com/x',
        visibility: 'private',
      });

      const output = directory.formatForLog();

      // An ephemeral tunnel's random subdomain IS the secret, so any
      // surviving fragment of the URL is a leak.
      expect(output).not.toContain('secret-sub');
      expect(output).not.toContain('trycloudflare.com');
      expect(output).toContain('<redacted: private service>');
    });

    it('prints public URLs verbatim', () => {
      const directory = new ServiceDirectory();
      directory.register({
        name: 'devbuild',
        url: 'https://public.example.com',
        visibility: 'public',
        description: 'WebGL build',
      });

      expect(directory.formatForLog()).toBe('devbuild: https://public.example.com - WebGL build');
    });

    it('reports an empty directory rather than an empty string', () => {
      expect(new ServiceDirectory().formatForLog()).toBe('No services registered.');
    });
  });
});
