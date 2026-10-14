import { HeroBand } from "@/components/Home/HeroBand";
import { TerminalPreview } from "@/components/Home/TerminalPreview";
import { ChapterTimeline } from "@/components/Home/ChapterTimeline";

export default function HomePage() {
  return (
    <>
      <HeroBand />
      <TerminalPreview />
      <ChapterTimeline />
    </>
  );
}
