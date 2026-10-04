export interface LicenseCheckResult {
  valid: boolean;
  failOpen?: boolean;
  warning?: string;
  error?: string;
}

export interface TrialCheckResult {
  valid: boolean;
  failOpen?: boolean;
  warning?: string;
  trial?: boolean;
  daysRemaining?: number;
  expiresAt?: string;
  checkoutUrl?: string;
  error?: string;
}

export interface TrialCheckOptions {
  instanceName: string;
  serverUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  failOpen?: boolean;
}

export async function checkTrial(
  options: TrialCheckOptions
): Promise<TrialCheckResult> {
  const {
    instanceName,
    serverUrl,
    fetchFn = fetch,
    timeoutMs = 10000,
    failOpen = true,
  } = options;

  const defaultUrl = "https://mcp-license-service.onrender.com";
  const baseUrl = (
    serverUrl ||
    process.env.MCP_LICENSE_SERVER_URL ||
    defaultUrl
  ).replace(/\/+$/, "");
  const trialUrl = `${baseUrl}/v1/licenses/trial`;

  try {
    const res = await fetchFn(trialUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ instance_name: instanceName }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status === 200) {
      const raw = (await res.json()) as Record<string, any>;
      return {
        valid: Boolean(raw.valid),
        trial: raw.trial !== undefined ? Boolean(raw.trial) : undefined,
        daysRemaining:
          typeof raw.daysRemaining === "number"
            ? raw.daysRemaining
            : typeof raw.days_remaining === "number"
            ? raw.days_remaining
            : undefined,
        expiresAt: raw.expiresAt || raw.expires_at,
        checkoutUrl: raw.checkoutUrl || raw.checkout_url,
        error: raw.error,
      };
    }

    if (failOpen && res.status >= 500) {
      return {
        valid: true,
        failOpen: true,
        warning: `License server returned status ${res.status}. Failing open to avoid blocking CI.`,
      };
    }

    return {
      valid: false,
      error: `Trial evaluation failed (server returned HTTP ${res.status})`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (failOpen) {
      return {
        valid: true,
        failOpen: true,
        warning: `Failed to contact license server for trial evaluation (${message}). Failing open to avoid blocking CI.`,
      };
    }
    return {
      valid: false,
      error: `Failed to contact license server for trial evaluation: ${message}`,
    };
  }
}

export interface LicenseVerifyOptions {
  licenseKey: string;
  instanceName: string;
  serverUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  failOpen?: boolean;
}

export async function verifyLicense(
  options: LicenseVerifyOptions
): Promise<LicenseCheckResult> {
  const {
    licenseKey,
    instanceName,
    serverUrl,
    fetchFn = fetch,
    timeoutMs = 10000,
    failOpen = true,
  } = options;

  const cleanKey = licenseKey.trim();
  if (!cleanKey) {
    return {
      valid: false,
      error: "License key cannot be empty",
    };
  }

  const defaultUrl = "https://mcp-license-service.onrender.com";
  const baseUrl = (serverUrl || process.env.MCP_LICENSE_SERVER_URL || defaultUrl).replace(/\/+$/, "");
  const validateUrl = `${baseUrl}/v1/licenses/validate`;
  const activateUrl = `${baseUrl}/v1/licenses/activate`;

  let validateRes: Response;
  try {
    validateRes = await fetchFn(validateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ license_key: cleanKey }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (failOpen) {
      return {
        valid: true,
        failOpen: true,
        warning: `Failed to contact license server for validation (${message}). Failing open to avoid blocking CI.`,
      };
    }
    return {
      valid: false,
      error: `License validation failed: ${message}`,
    };
  }

  if (validateRes.status !== 200) {
    if (failOpen && validateRes.status >= 500) {
      return {
        valid: true,
        failOpen: true,
        warning: `License server returned status ${validateRes.status}. Failing open to avoid blocking CI.`,
      };
    }
    return {
      valid: false,
      error: `License validation failed: server returned status ${validateRes.status}`,
    };
  }

  let validateData: { valid?: boolean; instance?: { name?: string }, error?: string };
  try {
    validateData = (await validateRes.json()) as typeof validateData;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: `Failed to parse license validation response: ${message}`,
    };
  }

  if (validateData.valid === true) {
    const instanceMatches = !validateData.instance?.name || validateData.instance.name === instanceName;
    if (instanceMatches) {
      return { valid: true };
    }
  }

  // Only call activate if validation failed (to register) or if instance didn't match (to re-bind if allowed)
  let activateRes: Response;
  try {
    activateRes = await fetchFn(activateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ license_key: cleanKey, instance_name: instanceName }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (failOpen) {
      return {
        valid: true,
        failOpen: true,
        warning: `Failed to contact license server for activation (${message}). Failing open to avoid blocking CI.`,
      };
    }
    return {
      valid: false,
      error: `License activation failed: ${message}`,
    };
  }

  if (activateRes.status !== 200) {
    if (failOpen && activateRes.status >= 500) {
      return {
        valid: true,
        failOpen: true,
        warning: `License server returned status ${activateRes.status}. Failing open to avoid blocking CI.`,
      };
    }
    return {
      valid: false,
      error: `License activation failed: server returned status ${activateRes.status}`,
    };
  }

  let activateData: { valid?: boolean };
  try {
    activateData = (await activateRes.json()) as typeof activateData;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: `Failed to parse license activation response: ${message}`,
    };
  }

  if (activateData.valid === true) {
    return { valid: true };
  }

  return {
    valid: false,
    error: validateData.error || "License activation failed: license key is not valid",
  };
}
