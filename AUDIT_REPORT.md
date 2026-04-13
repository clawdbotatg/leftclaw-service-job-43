# Audit Report — Cycle 1

## MUST FIX

- [x] **[HIGH]** Pagination semantics mismatch — frontend treats contract `offset` as a start index — `packages/nextjs/app/page.tsx:219-271` vs `packages/foundry/contracts/BurnBoard.sol:55-67` — `BurnBoard.getMessages(offset, limit)` interprets `offset` as the number of newest items to skip from the tail and returns the `limit` items immediately preceding that window (i.e. it pages backwards from the tail). The frontend's `MessageFeed` instead computes `calcOffset(page) = totalCount - page - PAGE_SIZE` and passes that as a normal start index. For any board where `totalCount > 50` this produces wrong output: with `totalCount = 100` the first batch calls `getMessages(50, 50)` which returns `messages[0..50)` (the OLDEST 50, not the newest), and the subsequent "LOAD MORE" call uses `getMessages(0, 50)` which returns `messages[50..100)` — the duplicate newest set, appended after the oldest. The feed will show stale/oldest messages on top and re-show the newest set on click. Fix by either (a) rewriting frontend `calcOffset/calcLimit` to use the contract's tail-cursor semantics (offset = number of newest already loaded), or (b) adding a contract function with conventional `(startIndex, limit)` semantics and switching the frontend to it.

- [x] **[HIGH]** Mobile deep-link hardcoded to MetaMask regardless of connected wallet — `packages/nextjs/app/page.tsx:74-79, 101-106` — Both `handleApprove` and `handlePost` unconditionally fire `window.location.href = "metamask://"` on any non-injected client. Users connected via WalletConnect using Rainbow, Phantom, Coinbase Wallet, Ledger Live, Safe, etc. will be navigated to the MetaMask app (or the App/Play Store if MetaMask is not installed) — they will never see the in-wallet signing prompt and the transaction will appear to silently fail. Per the QA skill, wallet detection must consult `connector.id` and the WalletConnect session payload in `localStorage`, then route to the matching scheme (`rainbow://`, `phantom://`, `cbwallet://`, `ledgerlive://`, etc.), and only then fall back to a generic prompt. The 500ms `setTimeout` is also tighter than the recommended 2000ms window and increases the chance the redirect lands before the wallet's RPC request is delivered.

- [x] **[HIGH]** No tests for the only critical path — `packages/foundry/test/.gitkeep` — The directory contains only a `.gitkeep`. `BurnBoard.post()` is the entire write surface (length validation, CEI ordering, reentrancy guard, `transferFrom` return-bool check, event emission) and is shipping with zero coverage. Add Forge tests covering: empty/280-byte/281-byte length boundary, `transferFrom` returning `false` (use a mock CLAWD), insufficient-balance / insufficient-allowance reverts, reentrancy via a malicious token, event topic+data correctness, and the `getMessages(offset, limit)` pagination boundaries (offset=0, offset=total, limit > MAX_PAGE_SIZE, total > MAX_PAGE_SIZE).

## KNOWN ISSUES

- **[LOW]** `handlePost` lacks the same `submitting`/`cooldown` double-spend guards as `handleApprove` — `packages/nextjs/app/page.tsx:94-113` — Once the user has allowance, the POST button is only disabled by the wagmi `isPending` flag. The window between the user clicking "POST & BURN" and `writeContractAsync` setting `isPending` (wallet hand-off) is small but non-zero, especially on mobile after the deep-link delay. Acceptable because each post burns a fixed 1000 CLAWD and requires a separate signature, but a `postSubmitting` state mirroring the approve flow would close the gap symmetrically.

- **[LOW]** No USD value displayed next to CLAWD amounts — `packages/nextjs/app/page.tsx:115, 153, 161, 319` — Balance, burn cost ("BURN 1000 CLAWD"), and total burned are shown as raw token amounts with no USD equivalent. The QA skill flags this as a FAIL, but CLAWD is a project-specific token without a guaranteed price feed on the Uniswap oracle wired into SE-2 utils, so a missing conversion is acceptable to ship.

- **[LOW]** `relativeTime()` runs at render time and uses `Date.now()` — `packages/nextjs/app/page.tsx:177-184, 198` — Timestamps will not refresh after mount until a re-render is forced, so an open tab will keep showing "5s ago" indefinitely. No correctness issue, just stale-looking UX.

- **[LOW]** Both `Home` and `MessageFeed` independently subscribe to `getMessageCount` — `packages/nextjs/app/page.tsx:211-214, 301-304` — Two RPC reads of the same value on every poll interval. Cheap and cache-coalesced by react-query, but a single hook lifted to a parent (or context) would be cleaner.

- **[LOW]** Header is hard-styled to the dark palette — `packages/nextjs/components/Header.tsx:14` — Inline `style={{ background: "#0a0a0a", borderBottom: "1px solid #39ff14" }}` ignores the active DaisyUI theme. In practice both the `light` and `dark` theme blocks in `globals.css` define identical CRT-green colors, so the visual outcome is correct, but `<SwitchTheme/>` exists in the codebase and toggling it is a no-op — inconsistent with the QA skill's "either fully theme-aware or remove the toggle" rule.

- **[LOW]** `getMessage(uint256)` is redundant — `packages/foundry/contracts/BurnBoard.sol:51-53` — Solidity's auto-generated public getter for the `messages` array already returns the struct fields. Harmless duplicate, no security impact.

- **[INFO]** Single-author duplicate-message risk uses `${author}-${timestamp}-${i}` as React key — `packages/nextjs/app/page.tsx:288` — Index `i` makes it locally unique, but if the same author posts twice in the same block the keys collide on the same render until the index disambiguates them. Index-as-key on top of dynamic data can cause subtle reorder/animation bugs; harmless here because the list is read-only.

- **[INFO]** Contract is intentionally ownerless / immutable — `packages/foundry/contracts/BurnBoard.sol:8-37` — No constructor args, no owner, no admin, no pause, no upgrade path. The brief's requirement that "privileged roles must be transferred to the client (0x34aA…fDF3)" is therefore N/A: the contract has no privileged roles to transfer. Footer and README correctly advertise this as a hyperstructure.

- **[INFO]** SE-2 default WalletConnect project ID and Alchemy API key fall through when env vars are unset — `packages/nextjs/scaffold.config.ts:14, 28-37` — `walletConnectProjectId` falls back to the public SE-2 default `3a8170…01d64` and `alchemyApiKey` falls back to `DEFAULT_ALCHEMY_API_KEY`. These are the well-known shared defaults, not leaked secrets, but the production deployment should set `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` and `NEXT_PUBLIC_ALCHEMY_API_KEY` in the hosting platform to avoid sharing rate limits with every other SE-2 fork.

- **[INFO]** `wagmiConfig.tsx` keeps a bare `http()` fallback — `packages/nextjs/services/web3/wagmiConfig.tsx:34-37` — The branch only triggers when no Alchemy URL and no override exist, which on Base + a configured Alchemy key never fires. Defensive code, not a live regression.

## Summary

- Must Fix: 3 items
- Known Issues: 9 items
- Audit frameworks followed: contract audit (ethskills), QA audit (ethskills)
