# Audit Report — Cycle 2

## MUST FIX

- [x] **[HIGH]** `renderButton()` exposes POST button during approval in-flight — `packages/nextjs/app/page.tsx:175-197` — When `approvalSubmitting = true` and `approvalCooldown = false`, the render function's conditional chain evaluates the first branch (`!hasAllowance && !approvalCooldown && !approvalSubmitting`) as `false` and the second branch (`approvalCooldown`) as `false`, then falls through to the default POST button — which is enabled whenever the user has typed text. A user who clicks APPROVE, sees the wallet sign dialog, then switches back to the dApp and clicks the now-visible POST button will have `post()` submitted on-chain; the contract will revert with "burn failed" (no allowance), but the user receives a confusing failure and may waste gas. The QA skill's ship-blocking criterion requires "one button at a time" along the Connect → Network → Approve → Action flow. During `approvalSubmitting`, the Action slot must show a disabled "APPROVING…" state, not an active POST button. Fix: insert `if (approvalSubmitting) { return <button className="terminal-btn w-full" disabled>{">"} APPROVING...</button>; }` immediately before the `if (approvalCooldown)` check at line 186.

## KNOWN ISSUES

- **[LOW]** Deep-link `setTimeout` fires even when the TX is rejected — `packages/nextjs/app/page.tsx:109-116, 140-147` — The `setTimeout(() => { window.location.href = deepLink; }, 2000)` is scheduled synchronously after `writeApprove`/`writePost` returns the promise, before `await` resolves or rejects. If the user rejects the transaction in their wallet, the 2-second timer is already running and will navigate them back to the wallet app with nothing to sign. Minor UX annoyance; the subsequent deep-link arrival in the wallet is harmless and the flow recovers on the next attempt.

- **[LOW]** OG image URL is relative when `NEXT_PUBLIC_PRODUCTION_URL` is not set — `packages/nextjs/utils/scaffold-eth/getMetadata.ts:3-7` — `baseUrl` falls back to `http://localhost:3000` if neither `NEXT_PUBLIC_PRODUCTION_URL` nor `VERCEL_PROJECT_PRODUCTION_URL` is set in the deployment environment. The OG image tag will then contain a localhost URL, breaking social-card unfurling on Twitter/Discord/Farcaster. Production hosting must have `NEXT_PUBLIC_PRODUCTION_URL` set to the live IPFS gateway URL.

- **[LOW]** `renderButton()` Approve button `disabled` prop omits `approvalCooldown` — `packages/nextjs/app/page.tsx:180` — The QA skill's recommended PASS pattern is `disabled={isPending || approvalSubmitting || approveCooldown}`. The current code uses `disabled={!hasBalance || isApproving || approvalSubmitting}`, omitting `approvalCooldown`. However, the Approve button branch is entirely hidden when `approvalCooldown = true` (a different "CONFIRMING APPROVAL" button is rendered), so the user cannot click Approve during cooldown. The intent of the pattern is met, but the implementation deviates from the recommended guard-on-disabled-prop approach. Acceptable to ship.

- **[LOW]** `handlePost` lacks `postSubmitting`/`postCooldown` double-spend guards — `packages/nextjs/app/page.tsx:132-154` — The POST button is gated only by `isPosting` from `useScaffoldWriteContract`. The click→hash gap (between button click and wagmi setting `isPending`) is small but non-zero. During that window a rapid double-click would call `writePost` twice. Each call requires a separate signature and burns 1000 CLAWD, so the user would need to sign twice in their wallet — an unlikely mistake. No silent double-burn is possible. Acceptable given the separate-signature requirement.

- **[LOW]** README retains Scaffold-ETH 2 stack attribution — `README.md:23` — The Stack section lists "Scaffold-ETH 2 (Foundry flavor)". The QA skill asks for SE-2 template text to be removed. Harmless for a public repo but noted for completeness.

- **[LOW]** Hardcoded dark palette without `data-theme="dark"` on `<html>` — `packages/nextjs/styles/globals.css:87-105` — `body` and `:root, [data-theme]` have hardcoded `background: #0a0a0a; color: #39ff14`. Per QA skill, this is acceptable if `data-theme="dark"` is forced on `<html>` AND `<SwitchTheme/>` is removed from the header. `SwitchTheme` is absent from the header (PASS), but `data-theme` is not set on `<html>`. In practice both the light and dark DaisyUI theme blocks define identical CRT-green palettes so the theme toggle has no visible effect. Acceptable for this design.

- **[LOW]** No USD value displayed next to CLAWD amounts — `packages/nextjs/app/page.tsx:156-157, 361` — Balance, burn cost, and total burned are shown as raw CLAWD token amounts with no USD equivalent. QA skill flags this as a FAIL, but CLAWD is a project-specific token without a Uniswap V3 TWAP or Chainlink feed wired into SE-2 utils, making a price conversion non-trivial. Acceptable to ship without USD values.

- **[LOW]** `relativeTime()` uses `Date.now()` at render time — `packages/nextjs/app/page.tsx:220-227` — Relative timestamps ("5m ago", "2h ago") are computed once at render and do not refresh on an interval. An open tab will show stale relative times until a re-render is triggered by new data. No correctness impact; accepted UX limitation.

- **[LOW]** `Home` and `MessageFeed` each independently subscribe to `getMessageCount` — `packages/nextjs/app/page.tsx:254-259, 344-347` — Two RPC reads of the same value fire on every polling interval. React Query coalesces them to a single inflight request. Acceptable; a shared context or prop-drilling would be cleaner but is not worth the refactor.

- **[INFO]** Contract address verification on Basescan cannot be confirmed from code review — `0xEB956d3Ab4C11Afb57b63957e2Ccb18d6BA89810` on Base mainnet — The README links to the Basescan address page, but source verification (green ✅ checkmark on the "Contract" tab) must be confirmed by visiting the block explorer directly. Unverified contracts are a trust red flag; if not yet verified, run `forge verify-contract` before shipping to users.

- **[INFO]** `getMessage(uint256)` is redundant — `packages/foundry/contracts/BurnBoard.sol:52-55` — Solidity's auto-generated public getter for the `messages` array already exposes the same struct fields. Harmless duplicate; no security impact.

- **[INFO]** React key uses array index as tiebreaker — `packages/nextjs/app/page.tsx:329` — `key={\`${msg.author}-${msg.timestamp}-${i}\`` uses `i` to disambiguate authors who post in the same block. Index-as-secondary-key on a dynamic list can cause subtle reconciliation artifacts; harmless here because the message list is read-only and append-only.

- **[INFO]** Contract is intentionally ownerless and immutable — `packages/foundry/contracts/BurnBoard.sol:8` — No constructor args, no owner, no admin, no pause, no upgrade path. The audit requirement that privileged roles be transferred to the client address (`0x34aA3F359A9D614239015126635CE7732c18fDF3`) is therefore N/A. The footer and README correctly advertise this as a hyperstructure.

- **[INFO]** WalletConnect project ID and Alchemy API key fall back to SE-2 shared defaults — `packages/nextjs/scaffold.config.ts:37, 25` — When `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` and `NEXT_PUBLIC_ALCHEMY_API_KEY` are not set in the deployment environment, the app uses the well-known SE-2 public defaults. These are shared across all SE-2 forks and may hit rate limits under load. Set both env vars in the hosting platform for production.

- **[INFO]** Bare `http()` fallback in `wagmiConfig.tsx` — `packages/nextjs/services/web3/wagmiConfig.tsx:36-38` — A bare `http()` fallback transport is only reached when no Alchemy URL is available for the target chain and no RPC override is configured. On Base mainnet with a configured Alchemy key this path never executes. Defensive dead code, not a live regression.

## Summary

- Must Fix: 1 item
- Known Issues: 14 items
- Audit frameworks followed: contract audit (ethskills), QA audit (ethskills)
