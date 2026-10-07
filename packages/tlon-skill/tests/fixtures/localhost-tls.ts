// Self-signed certificate for a TLS server on localhost, 127.0.0.1 or ::1,
// used by hermetic tests that need a subprocess to complete a real https
// request. It is its own CA (CA:TRUE), so a subprocess trusts it through
// NODE_EXTRA_CA_CERTS without any change to what it fetches. Test only: the
// private key is public by definition. Valid until 2126; regenerate with
//
//   openssl req -x509 -newkey rsa:2048 -nodes -days 36500 \
//     -subj "/CN=localhost" \
//     -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1" \
//     -addext "basicConstraints=critical,CA:TRUE"
export const LOCALHOST_TLS = {
  cert: `-----BEGIN CERTIFICATE-----
MIIDOjCCAiKgAwIBAgIUZugDpc1b4Alj7E5vYlYciSz+MvcwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MCAXDTI2MTAwNTE3NTY0N1oYDzIxMjYw
OTExMTc1NjQ3WjAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQCYax7ki1b9MxlTmQojDVMLkiyBllaQqb6Mcv5u5gC6
vrf1ZdKCW2JADRS+vNH2pGUQdlEbPs9XNSJftUQQjwPSA52wJaDPjxMT+lg7Ue0Z
AM8hJUZbNZ0cSumRUxtO7fjtCis4pKevN6aLaQhNzvKP+opaEa115gwBeJnGkphu
3PAtfR0WJHhGsQ2bM6ZYCu7Y/S5AFTR/Wm3mcJKOvcfSmko294rc4zZaEYOb/3v1
zz6LnSy1RyaRbIwScUWcN3FYKkM8Pl//1LpH5MhB7nL/k+Uv/U5HtCrkqf/E96uL
DUGvI98kd+bC0aPKyFFs5wsxYtj33nXwmlds4ijGn2FDAgMBAAGjgYEwfzAdBgNV
HQ4EFgQUsxwFNmMhVpFzjG55wDYpeJGNovUwHwYDVR0jBBgwFoAUsxwFNmMhVpFz
jG55wDYpeJGNovUwLAYDVR0RBCUwI4IJbG9jYWxob3N0hwR/AAABhxAAAAAAAAAA
AAAAAAAAAAABMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAIyz
hhIs2yGgyb7TJubxanGsSMlLgQqbiMdnhNUd+eXZx/Hhs5O0Kr9z30wPSjdSNBps
bBRaEqf35UVMeZVzHJOWBOm2zCReiH5UHAlTokFYDPKkVXowrC9L+8Qz1hwdEkh1
UuRtjzAiIhxpBz8gFxuddHs/g+Bq8m8Ds0odky2TRkmkGEy0TPgjxHN3V+zPf8v/
9yk28iS5YFLWmQJFNfk0pbn+ax2LnWtkYXuFIFi9zcyFQTkfystUemTRCQ958WTt
HjDlL7GA1xDlOMnTxlIwhSGcw+vzDxobptEooG0dOOklwMi8lz1L+qMXCLPBf8jb
xK93L2XjdDRWItuedTY=
-----END CERTIFICATE-----
`,
  key: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCYax7ki1b9MxlT
mQojDVMLkiyBllaQqb6Mcv5u5gC6vrf1ZdKCW2JADRS+vNH2pGUQdlEbPs9XNSJf
tUQQjwPSA52wJaDPjxMT+lg7Ue0ZAM8hJUZbNZ0cSumRUxtO7fjtCis4pKevN6aL
aQhNzvKP+opaEa115gwBeJnGkphu3PAtfR0WJHhGsQ2bM6ZYCu7Y/S5AFTR/Wm3m
cJKOvcfSmko294rc4zZaEYOb/3v1zz6LnSy1RyaRbIwScUWcN3FYKkM8Pl//1LpH
5MhB7nL/k+Uv/U5HtCrkqf/E96uLDUGvI98kd+bC0aPKyFFs5wsxYtj33nXwmlds
4ijGn2FDAgMBAAECggEAHCMmXFWW1P5SbhriAq+KhafR/IhG6cTUTvRJoSpntxHP
PwexkWwSWrWvfzi3YBtgJuZYubliKHzAIEAD1TS5pVMSkLqZkcedY4JDOIw6w3Nh
SYKqltryao8vyCq571vCKOxIJ1hKNnAFGFZm+Io8QDUlxlPeHFZAICNl7AETD+AD
iJ5NHoC4iQ4Og5gJ74+FOH2FHSRY822hkHLLfjexSlMK54+l5p9HxvcIpEFjDKyE
c/xqv5u5fQFBruyqhyAbh+E/YskqqlLJ8E1udy9+b5ke4aNYAxuiZ2w7+VRtXhQ3
/TiGUfbEU6fekdKXxZfeaYbHBzo0k+8ApBAUARAxvQKBgQDScPtxJ6qBoKEllYU0
XJZcopfkL4Qm+3MstJjOxrNbL8zah9nEYElhMSIQ9KJ4q0UiQsVfruMvufrG/mCY
u1sNMko5hLI1ss14Jw2TNvrmJHiESWJKC14fZfb60nshv+w34uRbftn9wdumFDbN
nQjqi8beriuE8XJxVfO/0+D1RQKBgQC5amkcXhNm36VrQErjcuGfPGvLMCM7dSSL
MuoUZj9a5KpZRhbbYEvJlJQWvZ9nxuzRS3ASQkBvZNFCZH8DZ5Io7B/kZAIUEqkS
OI2DV3HBHkbs7gyI7cnUisdNk4uUHocp84Jw+//PSSy0hJNHm91ocZ2zd2jSwbIq
OOYCFpLQ5wKBgQC5r//uZLXLE9WduEWFYn062C12p4bQbue99s0vB52TRKZZ3a2F
3gBhxlzs4S/LkjS6enh2aXcF0fE6TZMmsYsyJcHg5vno8BDliHAuCkFxeZTuBWK5
OzaeNfasc7U6noLs/UPKiDAJ/Vi3Pvbsjzgi3ZtpOf4knHgDEXi3N1o0kQKBgQCz
x6q9N7aGRAnHsWIrocOEu3glXrp6tz3EvoxbVTzO6/MEdsJI2dkCTs88MYZzgF01
Hnk/KwABQnbocjr5WR5OEY1mzVV6kxFeOnl0RYBl6O6KYtLCnhXZwOo4nPx0lRkn
oxXyaVWDbocrTXTktQt8btWjIv//gpI3AE587dhTNwKBgE9xQhqXYI/MsF3fFd8S
TgbVVuSjAwsm+rJQOGN75Wp/nEaok46EtrGx08Z+lwmUAabqjOXgPcoWuj0WyZ4L
T3u1pAzmkxhK5H4PKQEyI0fIz1tET5q6N357lnXSZ0SLhj3/EwppDtxNY69VA5Zb
IeRZkUsN9zFNlZ6XbsuxjyYm
-----END PRIVATE KEY-----
`,
};
