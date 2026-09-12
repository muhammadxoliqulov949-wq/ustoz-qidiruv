"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui";
import { logoutAction } from "@/server/actions/auth";

/* -------------------------------------------------------------------------- */
/* LogoutButton — a real sign-out. The server action DELETES the session row    */
/* and clears the cookie, so the token is revoked server-side rather than just  */
/* forgotten by the browser; a copied cookie stops working immediately.         */
/* Rendered as a form submit so it still works without JavaScript.              */
/* -------------------------------------------------------------------------- */

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <form action={() => startTransition(async () => { await logoutAction(); })}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        fullWidth
        loading={pending}
        leadingIcon={pending ? undefined : <LogOut />}
      >
        {pending ? "Chiqilmoqda…" : "Chiqish"}
      </Button>
    </form>
  );
}
