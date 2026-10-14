/** "ide" (default) renders chapters in the editor-style layout; "reader" renders plain pages. Set at build time. */
export const SITE_MODE: "ide" | "reader" =
  process.env.NEXT_PUBLIC_SITE_MODE === "reader" ? "reader" : "ide";
