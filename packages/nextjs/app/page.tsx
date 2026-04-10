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
  const { address: connectedAddress, isConnected } = useAccount();
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

  const handleApprove = async () => {
    if (approvalSubmitting || approvalCooldown) return;
    setApprovalSubmitting(true);
    try {
      const approvePromise = writeApprove({
        functionName: "approve",
        args: [BURN_BOARD_ADDRESS, BURN_COST],
      });
      // Mobile deep link: redirect to wallet before awaiting so user can sign
      if (typeof window !== "undefined" && !window.ethereum) {
        setTimeout(() => {
          window.location.href = "metamask://";
        }, 500);
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

  const handlePost = async () => {
    if (!text.trim() || isOverLimit) return;
    try {
      const postPromise = writePost({
        functionName: "post",
        args: [text],
      });
      // Mobile deep link: redirect to wallet before awaiting so user can sign
      if (typeof window !== "undefined" && !window.ethereum) {
        setTimeout(() => {
          window.location.href = "metamask://";
        }, 500);
      }
      await postPromise;
      notification.success("Message posted & 1000 CLAWD burned!");
      setText("");
    } catch (err) {
      handleError(err);
    }
  };

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

  // Calculate the offset for newest-first pagination
  const calcOffset = useCallback(
    (page: number) => {
      const start = totalCount - page - PAGE_SIZE;
      return start < 0 ? 0 : start;
    },
    [totalCount],
  );

  const calcLimit = useCallback(
    (page: number) => {
      const start = totalCount - page - PAGE_SIZE;
      return start < 0 ? totalCount - page : PAGE_SIZE;
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
