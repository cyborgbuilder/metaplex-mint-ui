"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { mintCompressedNFT } from "@/lib/mintCompressedNFT";
import { useState, useCallback, useMemo } from "react";
import MetaplexLogo from "@/assets/logos/metaplex-logo.png";
import Header from "@/components/header";

// --- IPFS helpers (gateway + fallback) ---
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

function ipfsToHttp(ipfsUri: string, gwIndex = 0) {
  // Accept ipfs://CID/path OR plain CID/path
  const path = ipfsUri.replace(/^ipfs:\/\//, "");
  return `${IPFS_GATEWAYS[gwIndex]}${path}`;
}

function IpfsImage({
  ipfsUri,
  alt,
  className,
  forcePngFromJson = false,
}: {
  ipfsUri: string; // can be ipfs://... or CID/...
  alt: string;
  className?: string;
  /** If true, replace .json with .png for preview tiles */
  forcePngFromJson?: boolean;
}) {
  const [gw, setGw] = useState(0);
  const httpSrc = useMemo(() => {
    const raw = forcePngFromJson ? ipfsUri.replace(".json", ".png") : ipfsUri;
    return ipfsToHttp(raw, gw);
  }, [ipfsUri, gw, forcePngFromJson]);

  return (
    <img
      src={httpSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (gw < IPFS_GATEWAYS.length - 1) setGw(gw + 1);
      }}
    />
  );
}

// Duplicate METADATA_URIS for previews (or export from lib and import)
const METADATA_URIS = [
  "ipfs://bafybeifikwvqllaf2yzonmm4seorkhlkshjtcqopog24rq75einzf6hp4a/variant-a.json",
  "ipfs://bafybeifikwvqllaf2yzonmm4seorkhlkshjtcqopog24rq75einzf6hp4a/variant-b.json",
  "ipfs://bafybeifikwvqllaf2yzonmm4seorkhlkshjtcqopog24rq75einzf6hp4a/variant-c.json",
];

export default function Home() {
  const { connected, connect, disconnect, publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [mintResult, setMintResult] = useState<{
    signature: string;
    uri: string; // metadata URI returned by mint
    explorerUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastClickTime, setLastClickTime] = useState(0); // For debouncing

  // Derive minted image (assumes metadata uses same filename w/ .png).
  // If your metadata's `image` field points elsewhere, you can fetch it client-side and use that URL instead.
  const mintedImageHttp = useMemo(() => {
    if (!mintResult?.uri) return null;
    const imgLike = mintResult.uri.endsWith(".json")
      ? mintResult.uri.replace(".json", ".png")
      : mintResult.uri;
    return ipfsToHttp(imgLike, 0);
  }, [mintResult?.uri]);

  const handleMint = useCallback(async () => {
    const now = Date.now();
    if (now - lastClickTime < 3000) {
      console.warn("⚠️ [page.tsx] Mint button clicked too soon. Please wait.");
      setError("Please wait a few seconds before minting again.");
      return;
    }
    setLastClickTime(now);
    console.log("🔄 [page.tsx] Mint button clicked at", new Date().toISOString());

    if (!connected) {
      console.log("🔍 [page.tsx] Wallet not connected. Triggering connect...");
      try {
        await connect();
        console.log("✅ [page.tsx] Wallet connect initiated.");
      } catch (err) {
        console.error("❌ [page.tsx] Wallet connect failed:", err);
        setError("Failed to connect wallet.");
      }
      return;
    }

    console.log("🚀 [page.tsx] Starting mint process for wallet:", publicKey?.toBase58());
    setLoading(true);
    setError(null);
    setMintResult(null);
    try {
      const result = await mintCompressedNFT();
      console.log("✅ [page.tsx] Mint successful:", result);
      setMintResult(result);
    } catch (err: any) {
      console.error("❌ [page.tsx] Mint failed:", err?.message, err?.stack);
      setError(err?.message ?? "Mint failed");
    } finally {
      console.log("🏁 [page.tsx] Mint process completed.");
      setLoading(false);
    }
  }, [connected, connect, publicKey, lastClickTime]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <Header />

      <div className="relative z-[-1] flex place-items-center before:absolute before:h-[300px] before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-[240px] after:translate-x-1/3 after:bg-gradient-conic after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700 before:dark:opacity-10 after:dark:from-sky-900 after:dark:via-[#0141ff] after:dark:opacity-40">
        <img
          className="relative dark:drop-shadow-[0_0_0.3rem_#ffffff70] dark:invert"
          src={MetaplexLogo.src}
          alt="Metaplex Logo"
          width={500}
        />
      </div>

      <div className="mb-32 flex flex-col items-center justify-center text-center lg:w-full lg:max-w-5xl lg:flex-col lg:text-left">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
          Mint Subscriber Giveaway NFT
        </h1>
        <p className="mb-8 text-lg text-gray-600 dark:text-gray-300 max-w-md text-center">
          Connect your wallet and mint one of 3 random variants from a 100,000 supply collection on Solana (devnet).
        </p>

        {/* Mint Button */}
        <button
          onClick={handleMint}
          disabled={!connected || loading}
          className="group rounded-lg border border-transparent px-8 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30 disabled:opacity-50 bg-blue-500 hover:bg-blue-600 text-white font-semibold shadow-lg"
        >
          {loading ? (
            <span className="flex items-center">
              Minting...
              <div className="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            </span>
          ) : connected ? (
            "Mint NFT (Free on Devnet)"
          ) : (
            "Connect Wallet"
          )}
        </button>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg max-w-md text-center">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Success Display */}
        {mintResult && (
          <div className="mt-6 p-6 bg-green-100 dark:bg-green-900 rounded-lg max-w-md text-center">
            <h3 className="font-semibold mb-2">Minted Successfully!</h3>
            <p>
              Variant:{" "}
              <strong>
                {mintResult.uri.split("/").pop()?.replace(".json", "") || "Unknown"}
              </strong>
            </p>
            <p className="mb-4">
              Signature:{" "}
              <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm">
                {mintResult.signature.slice(0, 8)}...
              </code>
            </p>

            {/* Minted image preview with IPFS gateway */}
            {mintedImageHttp && (
              <div className="mb-4">
                <img
                  src={mintedImageHttp}
                  alt="Minted NFT"
                  className="w-40 h-40 object-cover rounded mx-auto"
                  onError={(e) => {
                    // Try fallback gateways if initial one fails
                    for (let i = 1; i < IPFS_GATEWAYS.length; i++) {
                      const altUrl = ipfsToHttp(
                        mintResult.uri.replace(".json", ".png"),
                        i
                      );
                      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                      // @ts-ignore
                      if (e.currentTarget.dataset.tried !== String(i)) {
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        e.currentTarget.dataset.tried = String(i);
                        e.currentTarget.setAttribute("src", altUrl);
                        break;
                      }
                    }
                  }}
                />
              </div>
            )}

            <a
              href={mintResult.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              View on Explorer
            </a>
          </div>
        )}

        {/* Wallet Status */}
        {connected && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Connected: {publicKey?.toBase58().slice(0, 4)}...
            {publicKey?.toBase58().slice(-4)}
            <button onClick={disconnect} className="ml-4 text-red-500 underline">
              Disconnect
            </button>
          </p>
        )}

        {/* Variant Previews (using PNGs derived from metadata filenames) */}
        <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-md">
          {METADATA_URIS.map((uri, i) => (
            <div key={i} className="text-center">
              <IpfsImage
                ipfsUri={uri}
                forcePngFromJson
                alt={`Variant ${i + 1}`}
                className="w-20 h-20 object-cover rounded mx-auto mb-1"
              />
              <p className="text-xs text-gray-600 dark:text-gray-300">Variant {i + 1}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
