import { getWorkspace } from "@/lib/workspace";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  // getWorkspace() resolves the session and redirects to /login itself when
  // there's no authenticated user or workspace — /onboarding sits outside the
  // /dashboard tree that middleware guards, so this is where auth is enforced.
  const { workspace } = await getWorkspace();
  return <OnboardingForm initialName={workspace.name} />;
}
