const maxAttempts = 6;
const retryDelayMs = 5000;
let otp;
let lastBody = '';
let lastError;

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

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    otp = retrieveOtp();
    if (otp) {
      break;
    }
  } catch (e) {
    lastError = e;
  }

  if (attempt < maxAttempts) {
    wait(retryDelayMs);
  }
}

if (!otp) {
  const details = lastError
    ? ` Last error: ${lastError.message ?? lastError}`
    : lastBody
      ? ` Last response: ${lastBody}`
      : '';
  throw new Error(
    `Couldn't retrieve OTP for ${output.signupEmail} after ${maxAttempts} attempts.${details}`
  );
}

otp.split('').forEach((digit, index) => {
  output[`otpDigit${index + 1}`] = digit;
});
