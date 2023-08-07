export default function HeapYoutubePlayer({ embed }: { embed: any }) {
  const id = embed.url.split('v=')[1];

  return (
    <iframe
      className="min-h-[256px} h-2/3 w-full"
      src={`https://www.youtube.com/embed/${id}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      title={embed.title}
    />
  );
}
