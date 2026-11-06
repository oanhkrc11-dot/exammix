import { JoinRoomFlow } from "@/components/organisms/JoinRoomFlow";

export default async function JoinRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinRoomFlow code={code.toUpperCase()} />;
}
