const endpoint = `${process.env.SERVERLESS_INFRA_API}/sendAlertBotMessage`;

if (output.didComplete) {
  const duration = Number(output.operationEnd) - Number(output.operationStart);
  const durationSeconds = (duration / 1000).toFixed(0);
  const accountURL = `${process.env.HOSTING_DASH}/users?users-email=${output.signupEmail}`;
  const workflowsURL = `${process.env.EXPO_PROJECT}/workflows`;

  http.post(endpoint, {
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey: 'dtv@kvp!zde2abq7CKX',
      content: [
        {
          inline: [
            '✅ E2E Signup Success: ',
            {
              link: {
                href: accountURL,
                content: 'automated user',
              },
            },
            ` completed signup in ${durationSeconds} seconds (`,
            {
              link: {
                href: workflowsURL,
                content: 'info',
              },
            },
            `)`,
          ],
        },
      ],
    }),
  });
}
