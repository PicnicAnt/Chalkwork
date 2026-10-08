import Link from "next/link";
import { signOutAction } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth";

// Who is signed in, with a way to sign out, or a way to sign in.
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/login" className="link text-lg">
        Sign in
      </Link>
    );
  }
  return (
    <form action={signOutAction} className="flex items-center gap-2">
      <span className="max-w-[7rem] truncate text-lg" title={user.name}>
        {user.name}
      </span>
      <button type="submit" className="link text-base">
        Sign out
      </button>
    </form>
  );
}