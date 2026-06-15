const maxWaitMs = 15 * 60 * 1000;
const retryDelayMs = 20 * 1000;
let otp;
let lastBody = '';
let lastError;
let attempts = 0;

const startedAt = Date.now();
const deadline = startedAt + maxWaitMs;

function wait(ms) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < ms) {
    // Maestro scripts run synchronously; keep polling simple and local.
  }
}

function retrieveOtp() {
  const response = http.post(
    `${MAESTRO_SERVERLESS_INFRA_API}/retreiveE2eOtp`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: output.signupEmail }),
    }
  );

  lastBody = response.body == null ? '' : String(response.body).trim();
  return /^\d{6}$/.test(lastBody) ? lastBody : undefined;
}

while (Date.now() < deadline) {
  attempts += 1;

  try {
    otp = retrieveOtp();
    if (otp) {
      break;
    }
  } catch (e) {
    lastError = e;
  }

  const remainingWaitMs = deadline - Date.now();
  if (!otp && remainingWaitMs > 0) {
    wait(Math.min(retryDelayMs, remainingWaitMs));
  }
}

if (!otp) {
  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  const details = lastError
    ? ` Last error: ${lastError.message ?? lastError}`
    : lastBody
      ? ` Last response: ${lastBody}`
      : '';
  throw new Error(
    `Couldn't retrieve OTP for ${output.signupEmail} after ${attempts} attempts over ${elapsedSeconds}s.${details}`
  );
}

otp.split('').forEach((digit, index) => {
  output[`otpDigit${index + 1}`] = digit;
});
