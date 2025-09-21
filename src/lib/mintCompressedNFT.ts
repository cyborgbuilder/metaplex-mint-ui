import { publicKey as umiPublicKey } from '@metaplex-foundation/umi';
import { mintToCollectionV1 } from '@metaplex-foundation/mpl-bubblegum';
import umiWithCurrentWalletAdapter from './umi/umiWithCurrentWalletAdapter';
import sendAndConfirmWalletAdapter from './umi/sendAndConfirmWithWalletAdapter';

// === CONFIG ===
const TREE_ADDRESS = umiPublicKey('EpmQQngjpkqNpfrriw5JyXYbkUP6i1ph9h31vR2jEdvW'); // Your public tree
const COLLECTION_MINT = umiPublicKey('CPsXpcmo5B1os7Rr9FPNDj6oTwoCZqQ4S8QJAiQDJTSo'); // Your new collection mint
const METADATA_URIS = [
  'ipfs://bafybeifikwvqllaf2yzonmm4seorkhlkshjtcqopog24rq75einzf6hp4a/variant-a.json',
  'ipfs://bafybeifikwvqllaf2yzonmm4seorkhlkshjtcqopog24rq75einzf6hp4a/variant-b.json',
  'ipfs://bafybeifikwvqllaf2yzonmm4seorkhlkshjtcqopog24rq75einzf6hp4a/variant-c.json',
];

export async function mintCompressedNFT() {
  console.log('🔄 [mintCompressedNFT] Starting mint process at', new Date().toISOString());

  // Step 3a: Get UMI with wallet
  console.log('🔍 [mintCompressedNFT] Fetching UMI instance with wallet adapter...');
  const umi = umiWithCurrentWalletAdapter();
  if (!umi.identity.publicKey) {
    console.error('❌ [mintCompressedNFT] No wallet connected. Public key is null.');
    throw new Error('Wallet not connected—please connect your Solana wallet first.');
  }
  console.log('✅ [mintCompressedNFT] Wallet connected. Public key:', umi.identity.publicKey.toString());

  // Step 3b: Random URI selection
  console.log('🎲 [mintCompressedNFT] Selecting random metadata URI...');
  const uri = METADATA_URIS[Math.floor(Math.random() * METADATA_URIS.length)];
  console.log('✅ [mintCompressedNFT] Selected URI:', uri);

  // Step 3c: Set up args
  console.log('🛠 [mintCompressedNFT] Preparing mint arguments...');
  const merkleTree = TREE_ADDRESS;
  const collectionMint = COLLECTION_MINT;
  const leafOwner = umiPublicKey(umi.identity.publicKey.toString());
  console.log('ℹ️ [mintCompressedNFT] Merkle Tree:', merkleTree.toString());
  console.log('ℹ️ [mintCompressedNFT] Collection Mint:', collectionMint.toString());
  console.log('ℹ️ [mintCompressedNFT] Leaf Owner:', leafOwner.toString());

  try {
    // Step 3d: Build transaction (verified: false for public minting—no authority sig needed)
    console.log('📝 [mintCompressedNFT] Building mintToCollectionV1 transaction (unverified collection for public mint)...');
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
            address: umiPublicKey('44P1KCTk7dqLkZNFCdrYZ352Eps7bibSDqkpMYMLM3fG'), // Deployer as creator
            verified: true,
            share: 100,
          },
        ],
        collection: { key: collectionMint, verified: false }, // ← Key: false for public minting without authority sig
        uses: null,
      },
    });
    console.log('✅ [mintCompressedNFT] Transaction built successfully.');

    // Step 3e: Send & confirm
    console.log('🚀 [mintCompressedNFT] Sending and confirming transaction...');
    const result = await sendAndConfirmWalletAdapter(txBuilder, {
      commitment: 'confirmed',
      skipPreflight: false,
    });
    console.log('✅ [mintCompressedNFT] Transaction confirmed! Signature:', result.signature);
    console.log('ℹ️ [mintCompressedNFT] Minted NFT with URI:', uri);
    console.log('🔗 [mintCompressedNFT] Explorer URL: https://explorer.solana.com/tx/' + result.signature + '?cluster=devnet');

    return {
      signature: result.signature,
      uri,
      explorerUrl: `https://explorer.solana.com/tx/${result.signature}?cluster=devnet`,
    };
  } catch (error: any) {
    // Step 3f: Enhanced error handling
    console.error('❌ [mintCompressedNFT] Minting failed at', new Date().toISOString());
    console.error('❌ [mintCompressedNFT] Error details:', error.message);
    console.error('❌ [mintCompressedNFT] Error stack:', error.stack);

    // Log simulation details
    if (error.logs) {
      console.error('📋 [mintCompressedNFT] Simulation logs:', error.logs);
    } else if (error.getLogs) {
      try {
        const logs = await error.getLogs();
        console.error('📋 [mintCompressedNFT] Detailed logs:', logs);
      } catch (logError) {
        console.error('⚠️ [mintCompressedNFT] Log fetch failed:', logError);
      }
    }

    // Specific checks
    if (error.message.includes('duplicate instruction')) {
      throw new Error('Duplicate instructions—remove manual priority fees.');
    }
    if (error.message.includes('InvalidCollectionAuthority') || error.message.includes('6028') || error.message.includes('0x178c')) {
      throw new Error('Collection authority issue—use verified: false for public minting.');
    }
    if (error.message.includes('TreeAuthorityIncorrect') || error.message.includes('6016') || error.message.includes('0x1780')) {
      throw new Error('Tree not public—recreate with public: true.');
    }
    if (error.message.includes('Authority')) {
      throw new Error('Authority mismatch—use verified: false.');
    }
    if (error.message.includes('Collection')) {
      throw new Error('Invalid collection mint—double-check COLLECTION_MINT.');
    }
    if (error.message.includes('Tree')) {
      throw new Error('Invalid Merkle tree—double-check TREE_ADDRESS.');
    }
    if (error.message.includes('User rejected')) {
      throw new Error('Mint cancelled: User rejected signature.');
    }
    throw new Error(`Mint failed: ${error.message}`);
  }
}