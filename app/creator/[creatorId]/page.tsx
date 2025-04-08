import StreamView from "@/app/components/StreamView"

export default function Creator({
    params: {
        creatorId
    }
} : {
    params: {
        creatorId: string
    }
}) {
    return <div>
        <StreamView key={creatorId} creatorId={creatorId} playVideo={false}/>
    </div>
}