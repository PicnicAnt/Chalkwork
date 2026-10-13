import { signOutAction } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth";
import { AccountMenu } from "./AccountMenu";
import { SignInLink } from "./SignInLink";

// Who is signed in, as one button with the account options under it, or a way to sign in. Sits in the top right corner.
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return <SignInLink />;
  return <AccountMenu name={user.name} signOut={signOutAction} />;
}
