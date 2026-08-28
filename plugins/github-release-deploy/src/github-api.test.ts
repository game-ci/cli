import { describe, it, expect, vi } from "vitest";
import {
  getReleaseByTag,
  createRelease,
  deleteAsset,
  uploadAsset,
  stripUploadUrlTemplate,
  type GitHubApiOptions,
} from "./github-api";

function fakeOptions(fetchFn: typeof fetch): GitHubApiOptions {
  return { repo: "owner/repo", token: "secret-token", fetchFn };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("stripUploadUrlTemplate", () => {
  it("strips a URI template suffix", () => {
    expect(stripUploadUrlTemplate("https://uploads.github.com/repos/o/r/releases/1/assets{?name,label}")).toBe(
      "https://uploads.github.com/repos/o/r/releases/1/assets",
    );
  });

  it("leaves a URL with no template suffix untouched", () => {
    expect(stripUploadUrlTemplate("https://uploads.github.com/repos/o/r/releases/1/assets")).toBe(
      "https://uploads.github.com/repos/o/r/releases/1/assets",
    );
  });
});

describe("getReleaseByTag", () => {
  it("returns null on a 404 (no release for this tag yet)", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 404 }));
    const result = await getReleaseByTag(fakeOptions(fetchFn as unknown as typeof fetch), "v1.0.0");
    expect(result).toBeNull();
  });

  it("returns the release on a 200", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ id: 42, upload_url: "u", html_url: "h", assets: [] }));
    const result = await getReleaseByTag(fakeOptions(fetchFn as unknown as typeof fetch), "v1.0.0");
    expect(result?.id).toBe(42);
  });

  it("sends the Authorization header and hits the tags endpoint", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 404 }));
    await getReleaseByTag(fakeOptions(fetchFn as unknown as typeof fetch), "v1.0.0");

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/owner/repo/releases/tags/v1.0.0");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
  });

  it("throws on an unexpected non-404 error status", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 500 }));
    await expect(getReleaseByTag(fakeOptions(fetchFn as unknown as typeof fetch), "v1.0.0")).rejects.toThrow(/500/);
  });
});

describe("createRelease", () => {
  it("posts the expected JSON body", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ id: 1, upload_url: "u", html_url: "h", assets: [] }));
    await createRelease(fakeOptions(fetchFn as unknown as typeof fetch), {
      tag: "v1.0.0",
      body: "notes",
      draft: true,
      prerelease: false,
    });

    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ tag_name: "v1.0.0", name: "v1.0.0", body: "notes", draft: true, prerelease: false });
  });

  it("throws with the response body on failure", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 422 }));
    await expect(
      createRelease(fakeOptions(fetchFn as unknown as typeof fetch), { tag: "v1.0.0" }),
    ).rejects.toThrow(/422/);
  });
});

describe("deleteAsset", () => {
  it("does not throw on a 404 (already gone is fine)", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 404 }));
    await expect(deleteAsset(fakeOptions(fetchFn as unknown as typeof fetch), 99)).resolves.toBeUndefined();
  });

  it("throws on a genuine error status", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 500 }));
    await expect(deleteAsset(fakeOptions(fetchFn as unknown as typeof fetch), 99)).rejects.toThrow(/500/);
  });
});

describe("uploadAsset", () => {
  it("strips the URL template and appends the asset name as a query param", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ id: 7, name: "build.zip" }));
    await uploadAsset(
      fakeOptions(fetchFn as unknown as typeof fetch),
      "https://uploads.github.com/repos/o/r/releases/1/assets{?name,label}",
      "build.zip",
      Buffer.from("content"),
      "application/zip",
    );

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://uploads.github.com/repos/o/r/releases/1/assets?name=build.zip");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/zip");
  });

  it("throws with the response body on failure", async () => {
    const fetchFn = vi.fn(async () => new Response("already_exists", { status: 422 }));
    await expect(
      uploadAsset(fakeOptions(fetchFn as unknown as typeof fetch), "https://u", "a", Buffer.from(""), "application/octet-stream"),
    ).rejects.toThrow(/422/);
  });
});
