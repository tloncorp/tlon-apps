const MAIL_SERVER_ID = 'jcnomzrv';
const MAIL_API_KEY = 'EAW7fheHZaMtpBY9vwbggzEoP4nU5wHd';

const slug = Math.floor(Math.random() * 90000000) + 10000000;
const formattedSlug = String(slug).padStart(8, '0');

output.signupEmail = `e2e-${formattedSlug}@${MAIL_SERVER_ID}.mailosaur.net`;
