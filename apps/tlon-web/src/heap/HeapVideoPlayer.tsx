export default function HeapAudioPlayer({ source }: { source: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <video src={source} controls className="h-2/3 w-full" />
    </div>
  );
}
