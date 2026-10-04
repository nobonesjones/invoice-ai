// Expo push to every device a user has registered. Lifted from invoice-paid
// so every notification path prunes dead tokens the same way.

export async function sendPush(
  db: any,
  userId: string,
  message: { title: string; body: string; data: Record<string, unknown> },
  tag = "push",
): Promise<number> {
  const { data: tokens } = await db.from("push_tokens").select("token").eq("user_id", userId);
  const list: string[] = (tokens ?? []).map((t: any) => t.token).filter(Boolean);
  if (list.length === 0) return 0;

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(list.map((to) => ({ to, sound: "default", ...message }))),
  });
  if (!res.ok) {
    console.error(`[${tag}] expo push error`, res.status, await res.text());
    return 0;
  }
  const { data } = await res.json();
  let delivered = 0;
  const dead: string[] = [];
  (data ?? []).forEach((ticket: any, i: number) => {
    if (ticket.status === "ok") delivered++;
    else if (ticket.details?.error === "DeviceNotRegistered") dead.push(list[i]);
  });
  if (dead.length) await db.from("push_tokens").delete().in("token", dead);
  return delivered;
}
