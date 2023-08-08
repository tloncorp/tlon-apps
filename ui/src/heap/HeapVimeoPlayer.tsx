export default function HeapVimeoPlayer({ embed }: { embed: any }) {
  const id = embed.uri.split('videos/')[1];

  return (
    <iframe
      className="min-h-[256px} h-2/3 w-full"
      src={`https://player.vimeo.com/video/${id}`}
      allow="autoplay;"
      title={embed.title}
    />
  );
}
