export default function AudioEmbed({ url }: { url: string }) {
  // TODO: This is a placeholder for web. Implement a better audio player.

  return (
    <audio controls>
      <source src={url} type="audio/mpeg" />
      Your browser does not support the audio element.
    </audio>
  );
}
