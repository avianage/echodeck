import StreamView from "@/app/components/StreamView";

export default async function Creator(props: { params: Promise<{ creatorId: string }> }) {
  const { params } = props;
  const { creatorId } = await params;

  return (
    <div>
      <StreamView key={creatorId} creatorId={creatorId} playVideo={false} />
    </div>
  );
}
