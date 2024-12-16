export async function getLinkMetadata(url: string) {
  return fetch(`https://api.microlink.io/?url=${url}`).then((res) =>
    res.json()
  );
}
