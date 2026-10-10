"use server";

import { getCurrentUser } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/db";

export async function markAllRead(): Promise<void> {
  const user = await getCurrentUser();
  if (user) markNotificationsRead(user.id);
}
