import { ThreadView } from "@/components/thread/ThreadView";

/** Renders the client-driven full email thread route. */
export default function ThreadPage({ params }: { params: { id: string } }): JSX.Element {
  return <ThreadView threadId={params.id} />;
}
