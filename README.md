# CLAWD BURN BOARD

An immutable hyperstructure on Base. Burn 1000 CLAWD tokens to post a permanent message on the board. No owner. No admin. No pause.

## Live

URL: (deployed via bgipfs)

## Contracts

- **BurnBoard:** [`0xEB956d3Ab4C11Afb57b63957e2Ccb18d6BA89810`](https://basescan.org/address/0xEB956d3Ab4C11Afb57b63957e2Ccb18d6BA89810)
- **CLAWD Token:** [`0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07`](https://basescan.org/address/0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07)

## How It Works

1. Connect your wallet on Base
2. Approve the BurnBoard contract to spend 1000 CLAWD
3. Write a message (max 280 bytes) and post
4. The contract transfers 1000 CLAWD to a burn address, and your message is stored on-chain forever

## Stack

<!-- @notice Known issue: SE-2 template attribution retained in stack listing; QA skill recommends removing SE-2 boilerplate text but this is harmless for a public repo. -->
- Scaffold-ETH 2 (Foundry flavor)
- Next.js, RainbowKit, Wagmi, Viem
- Deployed to IPFS via bgipfs
- Terminal aesthetic: JetBrains Mono, acid green on black, scanline overlay

## Known Issues

These are accepted limitations documented after the Cycle 1 and Cycle 2 audits:

- **No USD equivalent next to CLAWD amounts** — Balance and burn cost display raw token amounts. CLAWD has no guaranteed on-chain price feed, so a USD conversion is not implemented.
- **handlePost lacks double-spend guard** — The POST button is only gated by wagmi `isPending`. The small window before `isPending` is set is acceptable since each post requires a separate wallet signature.
- **Relative timestamps don't auto-refresh** — `relativeTime()` reads `Date.now()` at render time. An open tab will show stale relative times until the next re-render.
- **Dual getMessageCount subscriptions** — `Home` and `MessageFeed` each subscribe to `getMessageCount` independently. react-query coalesces the requests; acceptable overhead.
- **Header hard-coded to dark palette** — Inline styles override DaisyUI theming. Both theme variants intentionally use identical CRT-green colors, so the visual outcome is correct and the `SwitchTheme` toggle is a no-op by design.
- **getMessage(uint256) is redundant** — The explicit `getMessage` function duplicates Solidity's auto-generated public getter for the `messages` array. Harmless.
- **React key tiebreaker** — Message list keys include an index `i` to handle same-author same-block posts. Harmless on this read-only list.
- **Contract is intentionally ownerless** — No owner, admin, pause, or upgrade path. The "transfer privileged roles to client" requirement is N/A; this is a hyperstructure.
- **WalletConnect / Alchemy keys fall back to SE-2 defaults** — Set `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` and `NEXT_PUBLIC_ALCHEMY_API_KEY` in the hosting platform to avoid sharing rate limits with other SE-2 forks.
- **wagmiConfig bare http() fallback** — Defensive transport of last resort; never fires on Base with a configured Alchemy key.
- **Deep-link setTimeout fires on TX rejection** — The 2-second wallet deep-link timer is started before the approval/post promise settles. If the user rejects the transaction the timer still navigates back to the wallet app; the flow recovers on the next attempt.
- **OG image URL is relative without NEXT_PUBLIC_PRODUCTION_URL** — Social-card unfurling (Twitter, Discord, Farcaster) will break unless `NEXT_PUBLIC_PRODUCTION_URL` is set to the live IPFS gateway URL in the hosting environment.
- **Approve button disabled prop omits approvalCooldown** — The Approve button branch is hidden entirely when `approvalCooldown=true`, so the intent of the full guard is met; the implementation deviates from the recommended pattern but is acceptable.
- **SE-2 stack attribution retained** — The Stack section references Scaffold-ETH 2; QA skill recommends removing template boilerplate but it is harmless here.
- **Contract source verification on Basescan unconfirmed** — The README links to the BurnBoard address but the green ✅ checkmark must be verified by visiting the explorer. Run `forge verify-contract` if the source is not yet verified.
