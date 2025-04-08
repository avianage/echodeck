"use client";

import StreamView from "../components/StreamView";

const creatorId = "ff79778f-b1ec-4a5b-9ca5-9177db586af0"

export default function Component(){
    return <StreamView key={creatorId} creatorId={creatorId} playVideo={true} />

}