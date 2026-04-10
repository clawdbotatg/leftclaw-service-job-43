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

- Scaffold-ETH 2 (Foundry flavor)
- Next.js, RainbowKit, Wagmi, Viem
- Deployed to IPFS via bgipfs
- Terminal aesthetic: JetBrains Mono, acid green on black, scanline overlay
