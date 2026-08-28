import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { GithubReleaseDeployCommand } from "./github-release-deploy-command";
import * as githubApi from "./github-api";

describe("GithubReleaseDeployCommand", () => {
  let tempDir: string;
  const originalToken = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "github-release-deploy-test-"));
    process.env.GITHUB_TOKEN = "test-token";
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.env.GITHUB_TOKEN = originalToken;
    vi.restoreAllMocks();
  });

  it("throws when GITHUB_TOKEN is not set", async () => {
    delete process.env.GITHUB_TOKEN;
    const command = new GithubReleaseDeployCommand();

    await expect(command.execute({ buildPath: tempDir, repo: "o/r", tag: "v1" })).rejects.toThrow(/GITHUB_TOKEN/);
  });

  it("throws when neither --repo nor $GITHUB_REPOSITORY is set", async () => {
    const command = new GithubReleaseDeployCommand();

    await expect(command.execute({ buildPath: tempDir, tag: "v1" })).rejects.toThrow(/--repo/);
  });

  it("throws when the build path does not exist", async () => {
    const command = new GithubReleaseDeployCommand();

    await expect(
      command.execute({ buildPath: path.join(tempDir, "does-not-exist"), repo: "o/r", tag: "v1" }),
    ).rejects.toThrow(/does not exist/);
  });

  it("throws when --assetName is given for a directory buildPath", async () => {
    const command = new GithubReleaseDeployCommand();

    await expect(
      command.execute({ buildPath: tempDir, repo: "o/r", tag: "v1", assetName: "renamed.zip" }),
    ).rejects.toThrow(/only valid when buildPath is a single file/);
  });

  it("creates a new release and uploads every top-level file in a directory", async () => {
    fs.writeFileSync(path.join(tempDir, "windows-build.zip"), "win");
    fs.writeFileSync(path.join(tempDir, "linux-build.zip"), "linux");
    fs.mkdirSync(path.join(tempDir, "nested"));
    fs.writeFileSync(path.join(tempDir, "nested", "ignored.txt"), "not top-level");

    vi.spyOn(githubApi, "getReleaseByTag").mockResolvedValue(null);
    const created = { id: 1, upload_url: "https://uploads/assets{?name}", html_url: "https://release", assets: [] };
    const createReleaseSpy = vi.spyOn(githubApi, "createRelease").mockResolvedValue(created);
    const uploadSpy = vi.spyOn(githubApi, "uploadAsset").mockResolvedValue({ id: 1, name: "x" });

    const command = new GithubReleaseDeployCommand();
    const result = await command.execute({ buildPath: tempDir, repo: "o/r", tag: "v1.0.0", releaseNotes: "notes" });

    expect(result).toBe(true);
    expect(createReleaseSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tag: "v1.0.0", body: "notes" }));
    expect(uploadSpy).toHaveBeenCalledTimes(2);
    const uploadedNames = uploadSpy.mock.calls.map((call) => call[2]).sort();
    expect(uploadedNames).toEqual(["linux-build.zip", "windows-build.zip"]);
  });

  it("reuses an existing release for the tag instead of creating a new one", async () => {
    fs.writeFileSync(path.join(tempDir, "build.zip"), "content");

    const existingRelease = { id: 5, upload_url: "https://uploads/assets{?name}", html_url: "https://release", assets: [] };
    vi.spyOn(githubApi, "getReleaseByTag").mockResolvedValue(existingRelease);
    const createReleaseSpy = vi.spyOn(githubApi, "createRelease");
    vi.spyOn(githubApi, "uploadAsset").mockResolvedValue({ id: 1, name: "build.zip" });

    const command = new GithubReleaseDeployCommand();
    await command.execute({ buildPath: tempDir, repo: "o/r", tag: "v1.0.0" });

    expect(createReleaseSpy).not.toHaveBeenCalled();
  });

  it("deletes and re-uploads an asset that already exists on the release (idempotent re-run)", async () => {
    fs.writeFileSync(path.join(tempDir, "build.zip"), "content");

    const existingRelease = {
      id: 5,
      upload_url: "https://uploads/assets{?name}",
      html_url: "https://release",
      assets: [{ id: 77, name: "build.zip" }],
    };
    vi.spyOn(githubApi, "getReleaseByTag").mockResolvedValue(existingRelease);
    const deleteSpy = vi.spyOn(githubApi, "deleteAsset").mockResolvedValue(undefined);
    vi.spyOn(githubApi, "uploadAsset").mockResolvedValue({ id: 78, name: "build.zip" });

    const command = new GithubReleaseDeployCommand();
    await command.execute({ buildPath: tempDir, repo: "o/r", tag: "v1.0.0" });

    expect(deleteSpy).toHaveBeenCalledWith(expect.anything(), 77);
  });

  it("uses $GITHUB_REPOSITORY when --repo is not given", async () => {
    process.env.GITHUB_REPOSITORY = "env-owner/env-repo";
    fs.writeFileSync(path.join(tempDir, "build.zip"), "content");

    vi.spyOn(githubApi, "getReleaseByTag").mockResolvedValue({
      id: 1,
      upload_url: "https://uploads/assets{?name}",
      html_url: "https://release",
      assets: [],
    });
    vi.spyOn(githubApi, "uploadAsset").mockResolvedValue({ id: 1, name: "build.zip" });

    const command = new GithubReleaseDeployCommand();
    await command.execute({ buildPath: tempDir, tag: "v1.0.0" });

    expect(githubApi.getReleaseByTag).toHaveBeenCalledWith(
      expect.objectContaining({ repo: "env-owner/env-repo" }),
      "v1.0.0",
    );
    delete process.env.GITHUB_REPOSITORY;
  });

  it("renames a single-file buildPath via --assetName", async () => {
    const filePath = path.join(tempDir, "original-name.zip");
    fs.writeFileSync(filePath, "content");

    vi.spyOn(githubApi, "getReleaseByTag").mockResolvedValue({
      id: 1,
      upload_url: "https://uploads/assets{?name}",
      html_url: "https://release",
      assets: [],
    });
    const uploadSpy = vi.spyOn(githubApi, "uploadAsset").mockResolvedValue({ id: 1, name: "renamed.zip" });

    const command = new GithubReleaseDeployCommand();
    await command.execute({ buildPath: filePath, repo: "o/r", tag: "v1.0.0", assetName: "renamed.zip" });

    expect(uploadSpy.mock.calls[0][2]).toBe("renamed.zip");
  });
});
