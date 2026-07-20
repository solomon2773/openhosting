import { pterodactylServer } from "@/lib/extensions/servers/pterodactyl";
import type { ServerDriver } from "@/lib/extensions/types";

// WISP — a hosted Pterodactyl fork for game hosts. API-compatible with
// Pterodactyl's application API.
export const wispServer: ServerDriver = {
  ...pterodactylServer,
  slug: "wisp",
  name: "WISP",
};
