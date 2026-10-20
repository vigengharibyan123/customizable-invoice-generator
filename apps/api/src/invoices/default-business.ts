import type { Business } from "@invoice/shared";

/** The fictional studio behind the demo data, also the sender profile before any invoice exists. */
export const DEFAULT_BUSINESS: Business = {
  name: "Lumen & Oak Studio",
  email: "billing@lumenandoak.example",
  phone: "(718) 555-0142",
  address: "214 Atlantic Ave, Suite 3\nBrooklyn, NY 11201",
};
