export interface LicenseCheckResult {
  valid: boolean;
  error?: string;
}

export interface LicenseVerifyOptions {
  licenseKey: string;
  instanceName: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export async function verifyLicense(
  options: LicenseVerifyOptions
): Promise<LicenseCheckResult> {
  const {
    licenseKey,
    instanceName,
    fetchFn = fetch,
    timeoutMs = 10000,
  } = options;

  const validateUrl = "https://api.lemonsqueezy.com/v1/licenses/validate";
  const activateUrl = "https://api.lemonsqueezy.com/v1/licenses/activate";

  let validateRes: Response;
  try {
    validateRes = await fetchFn(validateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: `license_key=${encodeURIComponent(licenseKey)}`,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: `License validation failed: ${message}`,
    };
  }

  if (validateRes.status !== 200) {
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

  // If valid is true and already has an active instance, continue
  if (validateData.valid === true && validateData.instance !== null && validateData.instance !== undefined) {
    return { valid: true };
  }

  // If valid is false, or instance is null and the key still needs activation, POST to activate
  if (validateData.valid === false || validateData.instance === null) {
    let activateRes: Response;
    try {
      activateRes = await fetchFn(activateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: `license_key=${encodeURIComponent(licenseKey)}&instance_name=${encodeURIComponent(instanceName)}`,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        valid: false,
        error: `License activation failed: ${message}`,
      };
    }

    if (activateRes.status !== 200) {
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
