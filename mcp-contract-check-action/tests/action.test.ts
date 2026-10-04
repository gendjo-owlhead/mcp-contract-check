import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoServerPath = path.resolve(__dirname, "../../mcp-check-demo/server.js");
const demoCasesDir = path.resolve(__dirname, "../../mcp-check-demo/cases");

const inputs: Record<string, string> = {};
let failedMessage: string | null = null;
let infoMessages: string[] = [];
let noticeMessages: string[] = [];
let warningMessages: string[] = [];
const outputs: Record<string, string> = {};

vi.mock("@actions/core", () => ({
  getInput: vi.fn((name: string) => inputs[name] || ""),
  setOutput: vi.fn((name: string, value: string) => {
    outputs[name] = value;
  }),
  setFailed: vi.fn((msg: string) => {
    failedMessage = msg;
  }),
  info: vi.fn((msg: string) => {
    infoMessages.push(msg);
  }),
  warning: vi.fn((msg: string) => {
    warningMessages.push(msg);
  }),
  notice: vi.fn((msg: string) => {
    noticeMessages.push(msg);
  }),
  summary: {
    addHeading: vi.fn().mockReturnThis(),
    addTable: vi.fn().mockReturnThis(),
    addRaw: vi.fn().mockReturnThis(),
    write: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockPayload: {
  repository?: {
    private?: boolean;
    full_name?: string;
    owner?: { login: string };
    name?: string;
  };
} = {};

vi.mock("@actions/github", () => ({
  context: {
    get payload() {
      return mockPayload;
    },
    get repo() {
      return { owner: "test-owner", repo: "test-repo" };
    },
  },
}));

// Import run, sendTelemetryPing, and parseHeaders after mocks are set
import { parseHeaders, run, sendTelemetryPing } from "../src/action.js";

describe("mcp-contract-check-action", () => {
  beforeEach(() => {
    for (const key of Object.keys(inputs)) {
      delete inputs[key];
    }
    for (const key of Object.keys(outputs)) {
      delete outputs[key];
    }
    failedMessage = null;
    infoMessages = [];
    noticeMessages = [];
    warningMessages = [];
    delete mockPayload.repository;
    vi.clearAllMocks();
  });

  it("public repo, broken server: fails the check, no license HTTP call", async () => {
    mockPayload.repository = { private: false, full_name: "public/repo" };
    inputs["command"] = `node "${demoServerPath}" --broken`;
    inputs["cases"] = demoCasesDir;

    const mockFetch = vi.fn();
    await run(mockFetch as unknown as typeof fetch);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(failedMessage).not.toBeNull();
    expect(failedMessage).toContain("Tool: echo");
  });

  it("private repo, no key, active trial: runs check and emits core notice", async () => {
    mockPayload.repository = { private: true, full_name: "private/repo" };
    inputs["command"] = `node "${demoServerPath}" --fixed`;
    inputs["cases"] = demoCasesDir;
    inputs["license-key"] = "";

    const mockFetch = vi.fn().mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        valid: true,
        trial: true,
        days_remaining: 11,
        checkout_url: "https://buy.stripe.com/14A28sgEM0kAdDm4RI0oM00",
      }),
    });

    await run(mockFetch as unknown as typeof fetch);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://mcp-license-service.onrender.com/v1/licenses/trial",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ instance_name: "private/repo" }),
      })
    );
    expect(failedMessage).toBeNull();
    expect(noticeMessages.length).toBe(1);
    expect(noticeMessages[0]).toContain("11 days remaining");
    expect(infoMessages).toContain("ok");
  });

  it("private repo, no key, expired trial: fails with checkout url", async () => {
    mockPayload.repository = { private: true, full_name: "private/repo" };
    inputs["command"] = `node "${demoServerPath}" --fixed`;
    inputs["license-key"] = "";

    const mockFetch = vi.fn().mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        valid: false,
        trial: false,
        error: "Trial for 'private/repo' expired. Subscribe at https://buy.stripe.com/14A28sgEM0kAdDm4RI0oM00",
        checkout_url: "https://buy.stripe.com/14A28sgEM0kAdDm4RI0oM00",
      }),
    });

    await run(mockFetch as unknown as typeof fetch);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(failedMessage).toContain("expired");
  });

  it("private repo, validate returns valid:true: check runs", async () => {
    mockPayload.repository = { private: true, full_name: "private/repo" };
    inputs["license-key"] = "valid-key";
    inputs["command"] = `node "${demoServerPath}" --fixed`;
    inputs["cases"] = demoCasesDir;

    const mockFetch = vi.fn().mockResolvedValueOnce({
      status: 200,
      json: async () => ({ valid: true, instance: { id: "inst-1" } }),
    });

    await run(mockFetch as unknown as typeof fetch);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://mcp-license-service.onrender.com/v1/licenses/validate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ license_key: "valid-key" }),
      })
    );
    expect(failedMessage).toBeNull();
    expect(infoMessages).toContain("ok");
  });

  it("private repo, validate returns valid:false: fails, check does not run", async () => {
    mockPayload.repository = { private: true, full_name: "private/repo" };
    inputs["license-key"] = "invalid-key";
    inputs["command"] = "node nonexistent-server.js";

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ valid: false }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ valid: false }),
      });

    await run(mockFetch as unknown as typeof fetch);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(failedMessage).toContain("License activation failed");
  });

  it("private repo, validate HTTP 500: fails open by default and emits warning", async () => {
    mockPayload.repository = { private: true, full_name: "private/repo" };
    inputs["license-key"] = "some-key";
    inputs["command"] = `node "${demoServerPath}" --fixed`;
    inputs["cases"] = demoCasesDir;

    const mockFetch = vi.fn().mockResolvedValueOnce({
      status: 500,
      json: async () => ({ error: "Internal Server Error" }),
    });

    await run(mockFetch as unknown as typeof fetch);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(warningMessages.some((m) => m.includes("status 500"))).toBe(true);
    expect(failedMessage).toBeNull();
    expect(outputs["compatible"]).toBe("true");
  });

  it("private repo, validate HTTP 500 with fail-open=false: fails closed", async () => {
    mockPayload.repository = { private: true, full_name: "private/repo" };
    inputs["license-key"] = "some-key";
    inputs["fail-open"] = "false";
    inputs["command"] = "node nonexistent-server.js";

    const mockFetch = vi.fn().mockResolvedValueOnce({
      status: 500,
      json: async () => ({ error: "Internal Server Error" }),
    });

    await run(mockFetch as unknown as typeof fetch);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(failedMessage).toContain("status 500");
  });

  it("private repo, no key, trial HTTP 500: fails open by default and emits warning", async () => {
    mockPayload.repository = { private: true, full_name: "private/repo" };
    inputs["command"] = `node "${demoServerPath}" --fixed`;
    inputs["cases"] = demoCasesDir;
    inputs["license-key"] = "";

    const mockFetch = vi.fn().mockResolvedValueOnce({
      status: 500,
      json: async () => ({ error: "Internal Server Error" }),
    });

    await run(mockFetch as unknown as typeof fetch);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(warningMessages.some((m) => m.includes("status 500"))).toBe(true);
    expect(failedMessage).toBeNull();
    expect(outputs["compatible"]).toBe("true");
  });

  it("private repo, validate returns valid:true but instance name mismatch calls activate", async () => {
    mockPayload.repository = { private: true, full_name: "private/repo" };
    inputs["license-key"] = "key-needs-activation";
    inputs["command"] = `node "${demoServerPath}" --fixed`;
    inputs["cases"] = demoCasesDir;

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ valid: true, instance: { name: "other/repo" } }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ valid: true, instance: { name: "private/repo" } }),
      });

    await run(mockFetch as unknown as typeof fetch);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://mcp-license-service.onrender.com/v1/licenses/validate",
      expect.anything()
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://mcp-license-service.onrender.com/v1/licenses/activate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ license_key: "key-needs-activation", instance_name: "private/repo" }),
      })
    );
    expect(failedMessage).toBeNull();
    expect(infoMessages).toContain("ok");
  });

  it("header parser parses key-value lines and JSON", () => {
    expect(parseHeaders(undefined)).toBeUndefined();
    expect(parseHeaders("")).toBeUndefined();
    expect(
      parseHeaders("Authorization: Bearer token\nX-Custom: hello")
    ).toEqual({
      Authorization: "Bearer token",
      "X-Custom": "hello",
    });
    expect(parseHeaders('{"Authorization": "Bearer 123"}')).toEqual({
      Authorization: "Bearer 123",
    });
  });

  it("fails if neither command nor url is provided", async () => {
    mockPayload.repository = { private: false, full_name: "public/repo" };
    const mockFetch = vi.fn();

    await run(mockFetch as unknown as typeof fetch);

    expect(failedMessage).toBe("Either 'command' or 'url' must be provided");
  });

  it("runs with fuzz mode enabled on fixed server", async () => {
    mockPayload.repository = { private: false, full_name: "public/repo" };
    inputs["command"] = `node "${demoServerPath}" --fixed`;
    inputs["cases"] = "non-existent-cases-folder";
    inputs["fuzz"] = "true";

    const mockFetch = vi.fn();
    await run(mockFetch as unknown as typeof fetch);

    expect(failedMessage).toBeNull();
    expect(infoMessages).toContain("ok");
    expect(Number(outputs["total"])).toBeGreaterThanOrEqual(1);
    expect(outputs["passed"]).toBe(outputs["total"]);
    expect(outputs["compatible"]).toBe("true");
  });

  it("sendTelemetryPing posts json to telemetry endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    });

    await sendTelemetryPing({
      mode: "public",
      repo: "community/mcp-server",
      version: "1.1.0",
      fetchFn: mockFetch as any,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://mcp-license-service.onrender.com/v1/telemetry/ping",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mode: "public",
          repo: "community/mcp-server",
          version: "1.1.0",
        }),
      })
    );
  });

  it("sendTelemetryPing handles network errors silently", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network offline"));

    await expect(
      sendTelemetryPing({
        mode: "trial",
        repo: "private/corp",
        fetchFn: mockFetch as any,
      })
    ).resolves.toBeUndefined();
  });

  it("run invokes telemetry ping when telemetryFetch is provided", async () => {
    mockPayload.repository = { private: false, full_name: "public/awesome-mcp" };
    inputs["command"] = `node "${demoServerPath}" --fixed`;
    inputs["cases"] = demoCasesDir;

    const mockLicenseFetch = vi.fn();
    const mockTelemetryFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    });

    await run(mockLicenseFetch as any, mockTelemetryFetch as any);

    expect(mockTelemetryFetch).toHaveBeenCalledTimes(1);
    expect(mockTelemetryFetch).toHaveBeenCalledWith(
      "https://mcp-license-service.onrender.com/v1/telemetry/ping",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mode: "public",
          repo: "public/awesome-mcp",
          version: "1.1.0",
        }),
      })
    );
    expect(failedMessage).toBeNull();
  });
});

