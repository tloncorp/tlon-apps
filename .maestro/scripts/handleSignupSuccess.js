const endpoint = `${MAESTRO_SERVERLESS_INFRA_API}/sendAlertBotMessage`;

if (output.didComplete) {
  const duration = Number(output.operationEnd) - Number(output.operationStart);
  const durationSeconds = (duration / 1000).toFixed(0);
  const accountURL = `${MAESTRO_HOSTING_DASH}/users?users-email=${output.signupEmail}`;
  const workflowsURL = `${MAESTRO_EXPO_PROJECT}/workflows`;

  http.post(endpoint, {
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey: MAESTRO_ALERT_BOT_API_KEY,
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
