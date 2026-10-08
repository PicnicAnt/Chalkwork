import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { countOpenSuggestionsForOwner } from "@/lib/db";
import { ThemeToggle } from "./ThemeToggle";

// The pages of the app, in a row under the headline, with the board switch at the far end.
export async function MainNav() {
  const user = await getCurrentUser();
  const waiting = user ? countOpenSuggestionsForOwner(user.id) : 0;
  return (
    <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <Link href="/new" className="link text-lg">
        New
      </Link>
      <Link href="/boards" className="link text-lg">
        Browse
      </Link>
      {user && (
        <Link href="/boards?mine=1" className="link text-lg">
          My boards
        </Link>
      )}
      {user && (
        <Link href="/suggestions" className="link text-lg">
          Suggestions{waiting > 0 ? ` (${waiting})` : ""}
        </Link>
      )}
      <span className="ml-auto">
        <ThemeToggle />
      </span>
    </nav>
  );
}