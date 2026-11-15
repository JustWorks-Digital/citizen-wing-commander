import { redirect } from "next/navigation";
import { appPaths } from "@/lib/appPaths";

/** Old Intake URL — keep bookmarks working. */
export default function IntakeRedirectPage() {
  redirect(appPaths.capture);
}
