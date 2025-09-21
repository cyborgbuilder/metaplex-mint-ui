// src/lib/mintCompressedNFT.ts
import { publicKey as umiPublicKey, PublicKey } from '@metaplex-foundation/umi';
import { mintToCollectionV1 } from '@metaplex-foundation/mpl-bubblegum';
import umiWithCurrentWalletAdapter from './umi/umiWithCurrentWalletAdapter';
import sendAndConfirmWalletAdapter from './umi/sendAndConfirmWithWalletAdapter';

/* -------------------------------- CONFIG -------------------------------- */
export const TREE_ADDRESS: PublicKey = umiPublicKey('EpmQQngjpkqNpfrriw5JyXYbkUP6i1ph9h31vR2jEdvW'); // public tree
export const COLLECTION_MINT: PublicKey = umiPublicKey('CPsXpcmo5B1os7Rr9FPNDj6oTwoCZqQ4S8QJAiQDJTSo'); // collection mint

export const METADATA_URIS = [
  'ipfs://bafybeifikwvqllaf2yzonmm4seorkhlkshjtcqopog24rq75einzf6hp4a/variant-a.json',
  'ipfs://bafybeifikwvqllaf2yzonmm4seorkhlkshjtcqopog24rq75einzf6hp4a/variant-b.json',
  'ipfs://bafybeifikwvqllaf2yzonmm4seorkhlkshjtcqopog24rq75einzf6hp4a/variant-c.json',
] as const;

/* ------------------------------ Return Types ----------------------------- */
export type MintCompressedResult = {
  signature: string;         // always a plain string (normalized)
  uri: string;               // metadata uri used
  explorerUrl: string;       // devnet url
};

/* --------------------------- Helper: normalize sig ----------------------- */
type SignatureLike =
  | string
  | [string, number]
  | { signature: string | [string, number] }
  | { txid?: string | [string, number] }
  | unknown;

function normalizeSignature(sigLike: SignatureLike): string {
  // common cases:
  // - string
  // - [signature, slot]
  // - { signature: string | [string, number] }
  // - { txid: string | [string, number] }
  const fromArray = (a: unknown) =>
    Array.isArray(a) ? String(a[0]) : String(a);

  if (typeof sigLike === 'string') return sigLike;
  if (Array.isArray(sigLike)) return String(sigLike[0]);

  if (sigLike && typeof sigLike === 'object') {
    const obj = sigLike as Record<string, unknown>;
    if (obj.signature !== undefined) return fromArray(obj.signature);
    if (obj.txid !== undefined) return fromArray(obj.txid);
  }

  // last resort
  return String(sigLike ?? '');
}

/* ------------------------------- The Mint -------------------------------- */
export async function mintCompressedNFT(): Promise<MintCompressedResult> {
  console.log('🔄 [mintCompressedNFT] Starting mint process at', new Date().toISOString());

  // 1) UMI + wallet
  console.log('🔍 [mintCompressedNFT] Fetching UMI instance with wallet adapter...');
  const umi = umiWithCurrentWalletAdapter();
  if (!umi.identity.publicKey) {
    console.error('❌ [mintCompressedNFT] No wallet connected. Public key is null.');
    throw new Error('Wallet not connected—please connect your Solana wallet first.');
  }
  console.log('✅ [mintCompressedNFT] Wallet connected. Public key:', umi.identity.publicKey.toString());

  // 2) Random URI
  const uri = METADATA_URIS[Math.floor(Math.random() * METADATA_URIS.length)];
  console.log('🎲 [mintCompressedNFT] Selected URI:', uri);

  // 3) Accounts
  const merkleTree = TREE_ADDRESS;
  const collectionMint = COLLECTION_MINT;
  const leafOwner = umiPublicKey(umi.identity.publicKey.toString());
  console.log('ℹ️ [mintCompressedNFT] Merkle Tree:', merkleTree.toString());
  console.log('ℹ️ [mintCompressedNFT] Collection Mint:', collectionMint.toString());
  console.log('ℹ️ [mintCompressedNFT] Leaf Owner:', leafOwner.toString());

  try {
    // 4) Build tx (unverified collection so public mint works)
    console.log('📝 [mintCompressedNFT] Building mintToCollectionV1 transaction (unverified collection)…');
    const txBuilder = mintToCollectionV1(umi, {
      leafOwner,
      leafDelegate: leafOwner,
      merkleTree,
      collectionMint,
      metadata: {
        name: 'Subscriber Giveaway',
        symbol: 'SUB',
        uri,
        sellerFeeBasisPoints: 0,
        creators: [
          {
            address: umiPublicKey('44P1KCTk7dqLkZNFCdrYZ352Eps7bibSDqkpMYMLM3fG'),
            verified: true,
            share: 100,
          },
        ],
        // Key: verified=false so we don't need collection authority sig on public mint
        collection: { key: collectionMint, verified: false },
        uses: null,
      },
    });
    console.log('✅ [mintCompressedNFT] Transaction built successfully.');

    // 5) Send & confirm
    console.log('🚀 [mintCompressedNFT] Sending and confirming transaction…');
    const raw = await sendAndConfirmWalletAdapter(txBuilder, {
      commitment: 'confirmed',
      skipPreflight: false,
    });

    const signature = normalizeSignature(
      // prefer `raw.signature` if present, otherwise pass whole thing
      (raw as any)?.signature ?? raw
    );

    if (!signature) {
      throw new Error('Missing transaction signature from send/confirm result.');
    }

    const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

    console.log('✅ [mintCompressedNFT] Transaction confirmed! Signature:', signature);
    console.log('ℹ️ [mintCompressedNFT] Minted NFT with URI:', uri);
    console.log('🔗 [mintCompressedNFT] Explorer URL:', explorerUrl);

    return { signature, uri, explorerUrl };
  } catch (error: any) {
    console.error('❌ [mintCompressedNFT] Minting failed at', new Date().toISOString());
    console.error('❌ [mintCompressedNFT] Error details:', error?.message);
    console.error('❌ [mintCompressedNFT] Error stack:', error?.stack);

    if (error?.logs) {
      console.error('📋 [mintCompressedNFT] Simulation logs:', error.logs);
    } else if (typeof error?.getLogs === 'function') {
      try {
        const logs = await error.getLogs();
        console.error('📋 [mintCompressedNFT] Detailed logs:', logs);
      } catch (logError) {
        console.error('⚠️ [mintCompressedNFT] Log fetch failed:', logError);
      }
    }

    // Specific, human-friendly messages
    const msg = String(error?.message ?? '');

    if (msg.includes('duplicate instruction')) {
      throw new Error('Duplicate instructions—remove manual priority fees.');
    }
    if (msg.includes('InvalidCollectionAuthority') || msg.includes('6028') || msg.includes('0x178c')) {
      throw new Error('Collection authority issue—use verified: false for public minting.');
    }
    if (msg.includes('TreeAuthorityIncorrect') || msg.includes('6016') || msg.includes('0x1780')) {
      throw new Error('Tree not public—recreate with public: true.');
    }
    if (msg.includes('Authority')) {
      throw new Error('Authority mismatch—use verified: false.');
    }
    if (msg.includes('Collection')) {
      throw new Error('Invalid collection mint—double-check COLLECTION_MINT.');
    }
    if (msg.includes('Tree')) {
      throw new Error('Invalid Merkle tree—double-check TREE_ADDRESS.');
    }
    if (msg.includes('User rejected')) {
      throw new Error('Mint cancelled: User rejected signature.');
    }

    throw new Error(`Mint failed: ${msg}`);
  }
}
