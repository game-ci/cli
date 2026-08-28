import { describe, it, expect } from "vitest";
import { parseWorkshopOutput } from "./parse-workshop-output";

describe("parseWorkshopOutput", () => {
  it("reports success and captures the id when PublishedFileId appears in the output", () => {
    const result = parseWorkshopOutput("Uploading...\nPublishedFileId: 123456789\n", 0);
    expect(result.success).toBe(true);
    expect(result.publishedFileId).toBe("123456789");
  });

  it("matches PublishedFileId regardless of a colon/equals separator", () => {
    expect(parseWorkshopOutput("PublishedFileId = 42", 0).publishedFileId).toBe("42");
    expect(parseWorkshopOutput("PublishedFileId 42", 0).publishedFileId).toBe("42");
  });

  it("does not trust exit code 0 alone as success when no PublishedFileId appears", () => {
    const result = parseWorkshopOutput("Logging in...\ndone.\n", 0);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain("no PublishedFileId");
  });

  it("falls back to the exit code plus output tail on a non-zero exit with no PublishedFileId", () => {
    const result = parseWorkshopOutput("ERROR! Upload failed.\n", 1);
    expect(result.success).toBe(false);
    expect(result.failureReason).toBe("exit code 1: ERROR! Upload failed.");
  });

  it("falls back to a bare exit code when there is no output", () => {
    const result = parseWorkshopOutput("", 1);
    expect(result.failureReason).toBe("exit code 1");
  });
});
