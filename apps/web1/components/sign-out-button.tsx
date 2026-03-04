"use client";

import { auth } from "@/lib/auth-client";

import { logout } from "@/app/actions/auth";

export function SignOutButton() {


  return (
    <button
      className="text-blue-500 hover:underline cursor-pointer"
      onClick={async () => {
        await logout();
      }}
    >
      Sign out
    </button>
  );
}