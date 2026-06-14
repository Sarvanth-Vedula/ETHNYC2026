// ENS integration (read-only). Our name `pulse.eth` is registered on the Sepolia
// testnet and its ETH address record points to the owner's wallet, so we resolve
// against Sepolia via a public RPC. No wallet, no deployment — live on-chain reads.
// Real ENS-specific code (viem's ENS resolution), not RainbowKit.

import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { normalize } from 'viem/ens';

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
});

export interface EnsProfile {
  name: string;
  address: string | null;
  avatar: string | null;
  description: string | null;
  url: string | null;
}

// Forward resolution + profile records for an ENS name (live from Sepolia).
export async function resolveEns(rawName: string): Promise<EnsProfile> {
  const name = normalize(rawName.trim());
  const [address, avatar, description, url] = await Promise.all([
    client.getEnsAddress({ name }).catch(() => null),
    client.getEnsAvatar({ name }).catch(() => null),
    client.getEnsText({ name, key: 'description' }).catch(() => null),
    client.getEnsText({ name, key: 'url' }).catch(() => null),
  ]);
  return { name, address, avatar, description, url };
}

// Reverse resolution: address → primary ENS name.
export async function lookupAddress(address: string): Promise<string | null> {
  return client.getEnsName({ address: address as `0x${string}` }).catch(() => null);
}
