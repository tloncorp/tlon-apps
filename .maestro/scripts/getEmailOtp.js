const response = http.post(
  `${process.env.SERVERLESS_INFRA_API}/retreiveE2eOtp`,
  {
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: output.signupEmail }),
  }
);

const otp = response.body;
if (!otp || otp.length !== 6) {
  throw new Error(`Couldn't retreive OTP for ${output.signupEmail}`);
}

otp.split('').forEach((digit, index) => {
  output[`otpDigit${index + 1}`] = digit;
});
