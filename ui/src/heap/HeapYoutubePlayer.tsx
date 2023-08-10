import getYoutubeId from 'get-youtube-id';

export default function HeapYoutubePlayer({ embed }: { embed: any }) {
  const id = getYoutubeId(embed.url);

  return (
    <iframe
      className="min-h-[256px} h-2/3 w-full"
      src={`https://www.youtube.com/embed/${id}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      title={embed.title}
    />
  );
}
