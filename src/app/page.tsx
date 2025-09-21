"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { mintCompressedNFT } from "@/lib/mintCompressedNFT";
import { useState, useCallback, useMemo, useEffect } from "react";
import Header from "@/components/header";

/* -------------------- IPFS helpers (gateway + fallback) -------------------- */
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

function ipfsToHttp(ipfsUriOrPath: string, gwIndex = 0) {
  // Accept: ipfs://CID/path OR CID/path
  const path = ipfsUriOrPath.replace(/^ipfs:\/\//, "");
  return `${IPFS_GATEWAYS[gwIndex]}${path}`;
}

/* ----------------------- Safer metadata-driven image ----------------------- */
type ResolvedImage = {
  httpUrl: string;
  tried: string[]; // helpful for debugging in console
};

async function resolveImageFromMetadata(
  metadataIpfs: string
): Promise<string | null> {
  // try gateways in order until metadata fetch succeeds
  const tried: string[] = [];
  for (let g = 0; g < IPFS_GATEWAYS.length; g++) {
    const url = ipfsToHttp(metadataIpfs, g);
    tried.push(url);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const json = await res.json();

      // Common fields: image, image_url, properties.files[0].uri
      let img: string | undefined =
        json.image || json.image_url ||
        json?.properties?.files?.[0]?.uri ||
        json?.properties?.files?.[0]?.url;

      if (typeof img === "string" && img.length > 0) {
        return img;
      }
    } catch {
      // try next gateway
    }
  }

  // If JSON fetch failed, return null to allow caller to guess fallbacks
  console.warn("[resolveImageFromMetadata] failed for", metadataIpfs, "tried:", tried);
  return null;
}

async function resolveImageHttp(
  metadataIpfs: string
): Promise<ResolvedImage | null> {
  // 1) Prefer metadata->image field
  const metaImg = await resolveImageFromMetadata(metadataIpfs);

  const candidateIpfsUrls: string[] = [];
  if (metaImg) {
    candidateIpfsUrls.push(metaImg);
  }

  // 2) Fallbacks if image wasn’t present or metadata unreachable:
  //    try swapping .json → common image extensions
  const base = metadataIpfs.replace(/\.json$/i, "");
  const exts = [".png", ".jpg", ".jpeg", ".webp"];
  for (const ext of exts) candidateIpfsUrls.push(base + ext);

  // 3) Try each candidate across gateways
  const tried: string[] = [];
  for (const ipfsLike of candidateIpfsUrls) {
    for (let g = 0; g < IPFS_GATEWAYS.length; g++) {
      const httpUrl = ipfsToHttp(ipfsLike, g);
      tried.push(httpUrl);
      try {
        const headRes = await fetch(httpUrl, { method: "HEAD", cache: "no-store" });
        if (headRes.ok) return { httpUrl, tried };
      } catch {
        // keep trying
      }
    }
  }

  console.warn("[resolveImageHttp] could not resolve image for", metadataIpfs, "tried:", tried);
  return null;
}

/* ----------------------------- Display component ---------------------------- */
function MetadataImage({
  metadataIpfsUri,
  alt,
  className,
}: {
  metadataIpfsUri: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [debugList, setDebugList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const resolved = await resolveImageHttp(metadataIpfsUri);
      if (!mounted) return;
      if (resolved) {
        setUrl(resolved.httpUrl);
        setDebugList(resolved.tried);
        console.debug("[MetadataImage] resolved", { metadataIpfsUri, ...resolved });
      } else {
        setUrl(null);
        setDebugList([]);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [metadataIpfsUri]);

  if (loading) {
    return (
      <div className={`relative ${className || ""}`}>
        <div className="absolute inset-0 animate-pulse rounded-xl bg-gradient-to-br from-slate-200/40 to-slate-300/40 dark:from-slate-700/40 dark:to-slate-800/40" />
        <div className="invisible h-full w-full rounded-xl" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-dashed border-slate-300/70 p-4 text-center text-xs text-slate-500 dark:border-slate-700/70 dark:text-slate-400 ${className || ""}`}>
        Image not available
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={`h-full w-full rounded-xl object-cover ${className || ""}`}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      onError={() => {
        // If the image fails at runtime (e.g., gateway hiccup), force re-resolve next paint
        setUrl(null);
        setLoading(true);
        // Trigger a new resolve by updating state with same prop
        setTimeout(() => setLoading(false), 0);
      }}
    />
  );
}

/* ---------------------------- Collection Metadata --------------------------- */
const METADATA_URIS = [
  "ipfs://bafybeifikwvqllaf2yzonmm4seorkhlkshjtcqopog24rq75einzf6hp4a/variant-a.json",
  "ipfs://bafybeifikwvqllaf2yzonmm4seorkhlkshjtcqopog24rq75einzf6hp4a/variant-b.json",
  "ipfs://bafybeifikwvqllaf2yzonmm4seorkhlkshjtcqopog24rq75einzf6hp4a/variant-c.json",
];

/* --------------------------------- Page --------------------------------- */
export default function Home() {
  const { connected, connect, disconnect, publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [mintResult, setMintResult] = useState<{
    signature: string;
    uri: string;
    explorerUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastClickTime, setLastClickTime] = useState(0);

  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(null), 3000);
      return () => clearTimeout(t);
    }
  }, [notice]);

  const mintedImageUrl = useMemo(() => {
    // We’ll still show a best-effort image for the minted card by
    // guessing .json → .png (user sees success fast). If it fails,
    // the <img onError> handler will re-resolve via gateways anyway.
    if (!mintResult?.uri) return null;
    const guess = (mintResult.uri.endsWith(".json")
      ? mintResult.uri.replace(".json", ".png")
      : mintResult.uri);
    return ipfsToHttp(guess, 0);
  }, [mintResult?.uri]);

  const handleMint = useCallback(async () => {
    const now = Date.now();
    if (now - lastClickTime < 3000) {
      setNotice("Please wait a moment before minting again.");
      return;
    }
    setLastClickTime(now);

    if (!connected) {
      try {
        await connect();
      } catch {
        setError("Failed to connect wallet.");
      }
      return;
    }

    setLoading(true);
    setError(null);
    setMintResult(null);

    try {
      const result = await mintCompressedNFT();
      setMintResult(result);
    } catch (err: any) {
      setError(err?.message ?? "Mint failed");
    } finally {
      setLoading(false);
    }
  }, [connected, connect, lastClickTime]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0a0b10] dark:text-slate-100">
      {/* Animated gradient blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-gradient-to-br from-indigo-400/30 via-sky-400/30 to-cyan-400/30 blur-3xl dark:from-indigo-600/20 dark:via-sky-600/20 dark:to-cyan-600/20 animate-[pulse_9s_ease-in-out_infinite]" />
        <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-gradient-to-tr from-fuchsia-400/30 via-violet-400/30 to-indigo-400/30 blur-3xl dark:from-fuchsia-600/20 dark:via-violet-600/20 dark:to-indigo-600/20 animate-[pulse_11s_ease-in-out_infinite]" />
      </div>

      <Header />

      <main className="mx-auto flex w-full max-w-7xl flex-col items-center px-6 pb-24 pt-10 sm:px-8 lg:px-12">
        {/* Hero */}
        <section className="relative w-full">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live on Devnet • 100,000 Supply
            </div>
            <h1 className="mt-4 bg-gradient-to-tr from-indigo-300 via-sky-300 to-cyan-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl lg:text-6xl">
              Mint Subscriber Giveaway NFT
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-300 sm:text-lg">
              Connect your wallet to mint one of 3 randomized variants from our compressed NFT collection on Solana.
            </p>

            {/* CTA + Wallet Badge */}
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={handleMint}
                disabled={loading}
                className="group relative inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-500 px-7 py-3 font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:scale-[1.02] hover:shadow-indigo-600/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/40 active:scale-[0.99] disabled:opacity-60"
              >
                {loading && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-b-transparent" />
                )}
                {loading ? "Minting..." : connected ? "Mint NFT (Free)" : "Connect Wallet & Mint"}
              </button>

              <div className="rounded-2xl border border-slate-200/60 bg-white/60 px-4 py-2 text-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                {connected ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    Connected:{" "}
                    <span className="font-mono">
                      {publicKey?.toBase58().slice(0, 4)}…{publicKey?.toBase58().slice(-4)}
                    </span>
                    <button
                      onClick={disconnect}
                      className="ml-2 rounded-lg px-2 py-1 text-xs text-rose-400 hover:bg-rose-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/30"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                    Wallet not connected
                  </div>
                )}
              </div>
            </div>

            {(notice || error) && (
              <div
                className={`mx-auto mt-4 max-w-md rounded-2xl border px-4 py-3 text-sm backdrop-blur ${
                  error
                    ? "border-rose-300/40 bg-rose-50/70 text-rose-800 dark:border-rose-300/20 dark:bg-rose-900/30 dark:text-rose-200"
                    : "border-amber-300/40 bg-amber-50/70 text-amber-800 dark:border-amber-300/20 dark:bg-amber-900/30 dark:text-amber-200"
                }`}
              >
                {error || notice}
              </div>
            )}
          </div>
        </section>

        {/* Content Grid */}
        <section className="mt-12 grid w-full grid-cols-1 items-start gap-8 lg:mt-16 lg:grid-cols-12">
          {/* Mint Card */}
          <div className="lg:col-span-5">
            <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white/70 p-6 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-500/20 via-sky-500/20 to-cyan-500/20 blur-2xl" />
              <h3 className="text-xl font-semibold">Your Mint</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                When mint completes, your NFT preview appears below. View the transaction on Solana Explorer.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-4">
                {mintResult ? (
                  <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur dark:border-white/10 dark:bg-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Variant
                        </div>
                        <div className="font-semibold">
                          {mintResult.uri.split("/").pop()?.replace(".json", "") || "Unknown"}
                        </div>
                      </div>
                      <code className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {mintResult.signature.slice(0, 10)}…
                      </code>
                    </div>

                    {mintedImageUrl && (
                      <div className="mt-4">
                        <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-2 backdrop-blur dark:border-white/10 dark:bg-white/10">
                          <img
                            src={mintedImageUrl}
                            alt="Minted NFT"
                            className="mx-auto h-56 w-full rounded-xl object-cover"
                            crossOrigin="anonymous"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              // If guess fails, try other gateways/extensions by re-running resolver:
                              (async () => {
                                const fallback = await resolveImageHttp(mintResult.uri);
                                if (fallback?.httpUrl) {
                                  e.currentTarget.src = fallback.httpUrl;
                                  console.debug("[Minted Preview Fallback] tried:", fallback.tried);
                                }
                              })();
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <a
                      href={mintResult.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-500/30 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                    >
                      View on Explorer
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 3h7m0 0v7m0-7L10 14" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v11h11" />
                      </svg>
                    </a>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300/70 p-8 text-center dark:border-slate-600/50">
                    <div className="mx-auto h-40 max-w-[16rem] rounded-xl bg-gradient-to-br from-slate-200/60 to-slate-300/60 backdrop-blur dark:from-slate-700/40 dark:to-slate-800/40" />
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                      No mint yet. Click <span className="font-semibold">Mint</span> to get your NFT.
                    </p>
                  </div>
                )}
              </div>

              {/* Tiny facts */}
              <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs">
                <div className="rounded-xl border border-slate-200/60 bg-white/60 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-white/5">
                  <div className="font-semibold">cNFT</div>
                  <div className="text-slate-500 dark:text-slate-400">Compressed</div>
                </div>
                <div className="rounded-xl border border-slate-200/60 bg-white/60 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-white/5">
                  <div className="font-semibold">Random</div>
                  <div className="text-slate-500 dark:text-slate-400">1 of 3</div>
                </div>
                <div className="rounded-xl border border-slate-200/60 bg-white/60 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-white/5">
                  <div className="font-semibold">Free</div>
                  <div className="text-slate-500 dark:text-slate-400">Devnet</div>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Gallery + Steps */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 gap-8">
              {/* Variant Previews */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Preview Variants</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Metadata-driven, multi-gateway fallback
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {METADATA_URIS.map((uri, i) => (
                    <div
                      key={i}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 p-2 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md backdrop-blur dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="relative h-40 w-full">
                        <MetadataImage
                          metadataIpfsUri={uri}
                          alt={`Variant ${i + 1}`}
                          className="h-full w-full"
                        />
                        <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/40" />
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs text-slate-600 dark:text-slate-300">Variant {i + 1}</p>
                        <span className="rounded-md bg-slate-900/90 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-white/10">
                          cNFT
                        </span>
                      </div>
                      <div className="absolute inset-0 -z-10 opacity-0 blur-2xl transition group-hover:opacity-40">
                        <div className="h-full w-full bg-gradient-to-br from-indigo-500/40 via-sky-500/40 to-cyan-500/40" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Steps / How it works */}
              <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white/70 p-6 backdrop-blur dark:border-white/10 dark:bg-white/5">
                <h3 className="text-lg font-semibold">How it works</h3>
                <ol className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <li className="rounded-xl border border-slate-200/60 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Step 1
                    </div>
                    <div className="mt-1 font-medium">Connect Wallet</div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                      We support Solana wallets via Wallet Adapter.
                    </p>
                  </li>
                  <li className="rounded-xl border border-slate-200/60 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Step 2
                    </div>
                    <div className="mt-1 font-medium">Mint</div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                      One click mints a random variant (free on Devnet).
                    </p>
                  </li>
                  <li className="rounded-xl border border-slate-200/60 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Step 3
                    </div>
                    <div className="mt-1 font-medium">View & Share</div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                      Preview appears here. Open on Explorer to verify.
                    </p>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* Footer note */}
        <section className="mt-14 w-full text-center text-xs text-slate-500 dark:text-slate-400">
          Built with metadata-driven IPFS resolution and multi-gateway fallback.
        </section>
      </main>
    </div>
  );
}
