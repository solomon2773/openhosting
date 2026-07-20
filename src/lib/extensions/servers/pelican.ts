import { pterodactylServer } from "@/lib/extensions/servers/pterodactyl";
import type { ServerDriver } from "@/lib/extensions/types";

// Pelican Panel — the actively-maintained Pterodactyl successor fork. Its
// application API is Pterodactyl-compatible, so we reuse that driver's
// lifecycle with a distinct slug/name.
export const pelicanServer: ServerDriver = {
  ...pterodactylServer,
  slug: "pelican",
  name: "Pelican Panel",
};
