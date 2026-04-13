"use client";

import React from "react";
import Link from "next/link";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

/**
 * Site header
 */
export const Header = () => {
  return (
    <div
      className="sticky lg:static top-0 navbar min-h-0 shrink-0 justify-between z-20 px-2 sm:px-4"
      // Known issue: inline styles hard-code the dark palette; SwitchTheme toggling is a no-op because both DaisyUI theme blocks define identical CRT-green colors.
      style={{ background: "#0a0a0a", borderBottom: "1px solid #39ff14" }}
    >
      <div className="navbar-start w-auto">
        <Link href="/" passHref className="terminal-label text-sm tracking-widest hover:opacity-80">
          CLAWD BURN BOARD
        </Link>
      </div>
      <div className="navbar-end grow mr-2">
        <RainbowKitCustomConnectButton />
      </div>
    </div>
  );
};
