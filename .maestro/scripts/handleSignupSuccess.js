const SERVERLESS_INFRA_ENDPOINT = 'https://serverless-infra.vercel.app/api';
const accountURL = `${process.env.HOSTING_ADMIN_URL}/users?users-email=${output.signupEmail}`;
const content = [];

http.post(`${SERVERLESS_INFRA_ENDPOINT}/sendAlertBotMessage`, {
  body: JSON.stringify({
    apiKey: process.env.ALERT_BOT_API_KEY,
    content: [
      {
        inline: [
          'Signup Success: ',
          {
            link: {
              href: accountURL,
              content: 'automated user',
            },
          },
          ` completed signup in ${outputs.durationSeconds} seconds`,
          {
            link: {
              href: accountURL,
              content: 'automated user',
            },
          },
        ],
      },
    ],
  }),
});
