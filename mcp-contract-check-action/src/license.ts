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
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: `instance_name=${encodeURIComponent(instanceName)}`,
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
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: `license_key=${encodeURIComponent(cleanKey)}`,
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

  let validateData: { valid?: boolean; instance?: unknown };
  try {
    validateData = (await validateRes.json()) as typeof validateData;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: `Failed to parse license validation response: ${message}`,
    };
  }

  const instanceObj =
    validateData.instance && typeof validateData.instance === "object"
      ? (validateData.instance as { id?: string; name?: string })
      : null;

  // If valid is true and instance matches instanceName (or instance has no name set yet)
  if (
    validateData.valid === true &&
    instanceObj !== null &&
    (!instanceObj.name || instanceObj.name === instanceName)
  ) {
    return { valid: true };
  }

  // If valid is false, instance is null, or instance is for another repo, POST to activate
  if (validateData.valid === false || instanceObj === null || (instanceObj.name && instanceObj.name !== instanceName)) {
    let activateRes: Response;
    try {
      activateRes = await fetchFn(activateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: `license_key=${encodeURIComponent(cleanKey)}&instance_name=${encodeURIComponent(instanceName)}`,
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
      error: "License activation failed: license key is not valid",
    };
  }

  return {
    valid: false,
    error: "License key is invalid",
  };
}
