import { redirect } from "next/navigation";

/** Preserves the explicit inbox route while keeping the root workspace canonical. */
export default function InboxAliasPage(): never {
  redirect("/");
}
