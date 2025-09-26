const slug = Math.floor(Math.random() * 90000000) + 10000000;
const formattedSlug = String(slug).padStart(8, '0');

output.signupEmail = `e2e-${formattedSlug}@${MAESTRO_TEST_MAIL_SERVER_ID}.mailosaur.net`;
