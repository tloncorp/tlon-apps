const endpoint = `${MAESTRO_SERVERLESS_INFRA_API}/sendAlertBotMessage`;

if (output.didComplete) {
  const nodeReadyDuration =
    Number(output.initialRailVisibleAt) - Number(output.nodeReadyStartedAt);
  const starterSetupDuration =
    Number(output.starterReadyAt) - Number(output.initialRailVisibleAt);
  const nodeReadySeconds = (nodeReadyDuration / 1000).toFixed(0);
  const starterSetupSeconds = (starterSetupDuration / 1000).toFixed(0);
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
            '✅ E2E Signup Success (',
            {
              link: {
                href: workflowsURL,
                content: 'info',
              },
            },
            `)`,
          ],
        },
        {
          inline: [`Node ready wait: ${nodeReadySeconds} seconds`],
        },
        {
          inline: [`Bot dialogue duration: ${starterSetupSeconds} seconds`],
        },
      ],
    }),
  });
}
