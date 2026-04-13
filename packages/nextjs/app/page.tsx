"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { formatUnits } from "viem";
import { base } from "viem/chains";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const BURN_COST = BigInt("1000000000000000000000"); // 1000 CLAWD (18 decimals)
const BURN_BOARD_ADDRESS = "0xEB956d3Ab4C11Afb57b63957e2Ccb18d6BA89810";
const PAGE_SIZE = 50;

// --- PostForm Component ---
const PostForm = () => {
  const { address: connectedAddress, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const [text, setText] = useState("");
  const [approvalCooldown, setApprovalCooldown] = useState(false);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);

  const byteLength = new TextEncoder().encode(text).length;
  const isOverLimit = byteLength > 280;

  // Read CLAWD balance
  const { data: clawdBalance } = useScaffoldReadContract({
    contractName: "CLAWD",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  // Read allowance
  const { data: allowance, refetch: refetchAllowance } = useScaffoldReadContract({
    contractName: "CLAWD",
    functionName: "allowance",
    args: [connectedAddress, BURN_BOARD_ADDRESS],
  });

  // Write hooks
  const { writeContractAsync: writeApprove, isPending: isApproving } = useScaffoldWriteContract({
    contractName: "CLAWD",
  });

  const { writeContractAsync: writePost, isPending: isPosting } = useScaffoldWriteContract({
    contractName: "BurnBoard",
  });

  const hasBalance = clawdBalance !== undefined && clawdBalance >= BURN_COST;
  const hasAllowance = allowance !== undefined && allowance >= BURN_COST;
  const isWrongChain = isConnected && chainId !== base.id;

  const handleError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("rejected") || msg.includes("denied") || msg.includes("user rejected")) {
      notification.error("Transaction rejected");
    } else {
      notification.error("Transaction failed. Please try again.");
    }
  };

  // Resolve a wallet-specific deep-link URI, consulting connector.id and WalletConnect
  // localStorage session metadata so mobile users land in the correct wallet app.
  const getWalletDeepLink = useCallback((): string | null => {
    if (!connector) return null;
    const id = connector.id;
    if (id === "metaMask") return "metamask://";
    if (id === "rainbow") return "rainbow://";
    if (id === "coinbaseWallet") return "cbwallet://";
    if (id === "walletConnect") {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.includes("wc@2")) {
            const val = localStorage.getItem(key);
            if (val) {
              const parsed = JSON.parse(val) as {
                value?: Array<{ peer?: { metadata?: { name?: string } } }>;
              };
              const peerName = parsed?.value?.[0]?.peer?.metadata?.name?.toLowerCase() ?? "";
              if (peerName.includes("rainbow")) return "rainbow://";
              if (peerName.includes("coinbase")) return "cbwallet://";
              if (peerName.includes("ledger")) return "ledgerlive://";
              if (peerName.includes("phantom")) return "phantom://";
            }
          }
        }
      } catch {
        // ignore parse errors
      }
      return null; // WalletConnect but peer wallet not identified — no redirect
    }
    return null;
  }, [connector]);

  const handleApprove = async () => {
    if (approvalSubmitting || approvalCooldown) return;
    setApprovalSubmitting(true);
    try {
      const approvePromise = writeApprove({
        functionName: "approve",
        args: [BURN_BOARD_ADDRESS, BURN_COST],
      });
      // Mobile deep link: route to the connected wallet before awaiting the signature
      if (typeof window !== "undefined" && !window.ethereum) {
        const deepLink = getWalletDeepLink();
        if (deepLink) {
          setTimeout(() => {
            window.location.href = deepLink;
          }, 2000);
        }
      }
      await approvePromise;
      notification.success("CLAWD approved!");
      setApprovalCooldown(true);
      setTimeout(() => {
        setApprovalCooldown(false);
        refetchAllowance();
      }, 4000);
    } catch (err) {
      handleError(err);
    } finally {
      setApprovalSubmitting(false);
    }
  };

  /// @notice Known issue: handlePost lacks the same submitting/cooldown double-spend guards as handleApprove — the POST button is only disabled by wagmi isPending; a postSubmitting state mirroring the approve flow would close the gap symmetrically.
  const handlePost = async () => {
    if (!text.trim() || isOverLimit) return;
    try {
      const postPromise = writePost({
        functionName: "post",
        args: [text],
      });
      // Mobile deep link: route to the connected wallet before awaiting the signature
      if (typeof window !== "undefined" && !window.ethereum) {
        const deepLink = getWalletDeepLink();
        if (deepLink) {
          setTimeout(() => {
            window.location.href = deepLink;
          }, 2000);
        }
      }
      await postPromise;
      notification.success("Message posted & 1000 CLAWD burned!");
      setText("");
    } catch (err) {
      handleError(err);
    }
  };

  /// @notice Known issue: balance, burn cost, and total burned show raw CLAWD amounts with no USD equivalent — acceptable because CLAWD has no guaranteed on-chain price feed.
  const formattedBalance = clawdBalance !== undefined ? Number(formatUnits(clawdBalance, 18)).toLocaleString() : "---";

  // Determine button state
  const renderButton = () => {
    if (!isConnected) {
      return (
        <button className="terminal-btn w-full" onClick={() => openConnectModal?.()}>
          {">"} CONNECT WALLET
        </button>
      );
    }
    if (isWrongChain) {
      return (
        <button className="terminal-btn w-full" onClick={() => switchChain({ chainId: base.id })}>
          {">"} SWITCH TO BASE
        </button>
      );
    }
    if (!hasAllowance && !approvalCooldown && !approvalSubmitting) {
      return (
        <button
          className="terminal-btn w-full"
          onClick={handleApprove}
          disabled={!hasBalance || isApproving || approvalSubmitting}
        >
          {!hasBalance ? "> INSUFFICIENT CLAWD" : isApproving ? "> APPROVING..." : "> APPROVE CLAWD"}
        </button>
      );
    }
    if (approvalCooldown) {
      return (
        <button className="terminal-btn w-full" disabled>
          {">"} CONFIRMING APPROVAL...
        </button>
      );
    }
    return (
      <button className="terminal-btn w-full" onClick={handlePost} disabled={!text.trim() || isOverLimit || isPosting}>
        {isPosting ? "> POSTING..." : "> POST & BURN 1000 CLAWD"}
      </button>
    );
  };

  return (
    <div className="terminal-card">
      <div className="flex justify-between items-center mb-2">
        <span className="terminal-label">BALANCE: {formattedBalance} CLAWD</span>
        <span className={`terminal-label ${isOverLimit ? "text-red-500" : ""}`}>{byteLength}/280</span>
      </div>
      <textarea
        className="terminal-textarea"
        placeholder="ENTER YOUR MESSAGE..."
        value={text}
        onChange={e => setText(e.target.value)}
        rows={4}
      />
      <div className="mt-3">{renderButton()}</div>
    </div>
  );
};

// --- Relative time helper ---
/// @notice Known issue: relativeTime() reads Date.now() at render time; timestamps will not auto-refresh after mount, leaving an open tab showing stale relative times until a re-render is triggered.
const relativeTime = (timestamp: number) => {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// --- MessageCard Component ---
type MessageData = {
  author: string;
  timestamp: bigint;
  text: string;
};

const MessageCard = ({ msg }: { msg: MessageData }) => {
  return (
    <div className="terminal-card mb-3">
      <div className="flex justify-between items-center mb-1 flex-wrap gap-1">
        <Address address={msg.author} chain={base} />
        <span className="terminal-label text-xs opacity-60">{relativeTime(Number(msg.timestamp))}</span>
      </div>
      <p className="terminal-text break-words whitespace-pre-wrap">{msg.text}</p>
    </div>
  );
};

// --- MessageFeed Component ---
const MessageFeed = () => {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const { data: messageCount } = useScaffoldReadContract({
    contractName: "BurnBoard",
    functionName: "getMessageCount",
  });

  const totalCount = messageCount ? Number(messageCount) : 0;

  /// @notice Known issue: MessageFeed and Home each independently subscribe to getMessageCount — two RPC reads of the same value on every poll interval; a shared context or lifted state would be cleaner but is acceptable since react-query coalesces the requests.
  // calcOffset: pass already-loaded count as the tail cursor.
  // The contract interprets offset as "skip this many newest messages from the tail",
  // so passing the number we have already loaded pages backwards correctly.
  const calcOffset = useCallback((loaded: number) => loaded, []);

  // calcLimit: request up to PAGE_SIZE, capped to the remaining unloaded messages.
  const calcLimit = useCallback(
    (loaded: number) => {
      const remaining = totalCount - loaded;
      return remaining > PAGE_SIZE ? PAGE_SIZE : remaining;
    },
    [totalCount],
  );

  // Fetch first batch
  const { data: firstBatch } = useScaffoldReadContract({
    contractName: "BurnBoard",
    functionName: "getMessages",
    args: [BigInt(calcOffset(0)), BigInt(calcLimit(0))],
    query: {
      enabled: totalCount > 0,
    },
  });

  useEffect(() => {
    if (firstBatch && firstBatch.length > 0) {
      const reversed = [...firstBatch].reverse() as unknown as MessageData[];
      setMessages(reversed);
      setOffset(firstBatch.length);
      setHasMore(firstBatch.length < totalCount);
    }
  }, [firstBatch, totalCount]);

  // Load more
  const { data: moreBatch, refetch: fetchMore } = useScaffoldReadContract({
    contractName: "BurnBoard",
    functionName: "getMessages",
    args: [BigInt(calcOffset(offset)), BigInt(calcLimit(offset))],
    query: {
      enabled: false,
    },
  });

  useEffect(() => {
    if (moreBatch && moreBatch.length > 0) {
      const reversed = [...moreBatch].reverse() as unknown as MessageData[];
      setMessages(prev => [...prev, ...reversed]);
      setOffset(prev => prev + moreBatch.length);
      setHasMore(offset + moreBatch.length < totalCount);
    }
  }, [moreBatch, offset, totalCount]);

  const handleLoadMore = () => {
    fetchMore();
  };

  if (totalCount === 0) {
    return (
      <div className="terminal-card text-center opacity-60">
        <p className="terminal-text">NO MESSAGES YET -- BE THE FIRST TO BURN.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Known issue: key uses index i as tiebreaker; same author posting twice in the same block can cause subtle reorder bugs until i disambiguates — harmless on this read-only list. */}
      {messages.map((msg, i) => (
        <MessageCard key={`${msg.author}-${msg.timestamp}-${i}`} msg={msg} />
      ))}
      {hasMore && (
        <button className="terminal-btn w-full mt-2" onClick={handleLoadMore}>
          {">"} LOAD MORE
        </button>
      )}
    </div>
  );
};

// --- Main Page ---
const Home: NextPage = () => {
  /// @notice Known issue: Home and MessageFeed each independently subscribe to getMessageCount — react-query coalesces the requests, but a shared context would be cleaner.
  const { data: messageCount } = useScaffoldReadContract({
    contractName: "BurnBoard",
    functionName: "getMessageCount",
  });

  const totalCount = messageCount ? Number(messageCount) : 0;
  const totalBurned = totalCount * 1000;

  return (
    <div className="flex flex-col items-center grow">
      {/* Scanline overlay */}
      <div className="scanline-overlay" />

      {/* Top bar */}
      <div className="w-full max-w-2xl px-4 pt-6 pb-2">
        <h1 className="terminal-title text-center text-2xl md:text-3xl tracking-widest mb-1">CLAWD BURN BOARD</h1>
        <div className="flex justify-center gap-6 terminal-label text-sm mb-2">
          <span>MSGS: {totalCount}</span>
          <span>BURNED: {totalBurned.toLocaleString()} CLAWD</span>
        </div>

        {/* Contract address */}
        <div className="flex justify-center mb-4">
          <Address address={BURN_BOARD_ADDRESS} chain={base} />
        </div>
      </div>

      {/* Post form */}
      <div className="w-full max-w-2xl px-4 mb-6">
        <PostForm />
      </div>

      {/* Message feed */}
      <div className="w-full max-w-2xl px-4 pb-8">
        <MessageFeed />
      </div>
    </div>
  );
};

export default Home;
