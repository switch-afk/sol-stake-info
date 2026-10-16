# sol-stake-info

[![CI](https://github.com/switch-afk/sol-stake-info/actions/workflows/ci.yml/badge.svg)](https://github.com/switch-afk/sol-stake-info/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/sol-stake-info)](https://www.npmjs.com/package/sol-stake-info)
[![license](https://img.shields.io/npm/l/sol-stake-info)](LICENSE)

Inspect a Solana stake account from your terminal: whether it is active, activating, deactivating or inactive, how much SOL is staked, which validator it points at, who controls it, and whether a lockup is in force. Give it a wallet instead and it lists every stake account that wallet controls.

A stake account is where staked SOL lives. Activating and deactivating stake happens at epoch boundaries and is throttled across the whole network, so a stake can sit partly active for a few epochs. sol-stake-info asks an RPC for the account, the current epoch and the cluster's stake history, works out where the stake stands, and prints it. No SDK, no wallet, nothing to sign.

- Status with exact amounts: how much is active, activating or deactivating
- Validator, activation and deactivation epochs, rent reserve, staker, withdrawer and lockup
- `--wallet` lists all the stake accounts of a wallet, with a table and totals
- `--json` is there for scripts
- Read-only, zero dependencies, Node 18+

## Install

```bash
npx sol-stake-info <stake-account>
```

Or install it globally:

```bash
npm install -g sol-stake-info
```

## Usage

```bash
sol-stake-info <stake-account> [options]
sol-stake-info --wallet <address> [options]
```

| Option | Description |
| --- | --- |
| `--wallet <address>` | List the stake accounts the wallet controls, as staker or withdrawer. Cannot be combined with a stake account address. Needs an RPC that allows `getProgramAccounts` |
| `--rpc <url>` | RPC endpoint (or set `SOL_STAKE_INFO_RPC`) |
| `--json` | Print machine-readable JSON |
| `-h`, `--help` | Show help |
| `-v`, `--version` | Show the version |

## Look up a stake account

```bash
sol-stake-info H4iQ8wEYziagrEdVyFFZPNW966nenPjATdxWSWkVa8rz
```

```
Stake account  H4iQ8wEYziagrEdVyFFZPNW966nenPjATdxWSWkVa8rz
Status         active
Current epoch  912
Balance        12.50228288 SOL
Delegated      12.5 SOL
Active         12.5 SOL
Validator      4VTAsMXyeT43eu1hR3nNsBvvA9hVqLAy6HbRBeS8Jb3B
Activation     epoch 880
Rent reserve   0.00228288 SOL
Staker         3TH7TndHEF9VDYAgPfNFLdGcsshZmhcDSgVr8VQZEWfd
Withdrawer     3TH7TndHEF9VDYAgPfNFLdGcsshZmhcDSgVr8VQZEWfd
Lockup         none
RPC            api.mainnet-beta.solana.com
```

`Balance` is everything in the account. `Delegated` is the amount handed to the validator, and the rest is the rent reserve. `Active`, `Activating` and `Deactivating` are only shown when they are not zero. A stake that was told to stop shows the deactivation epoch:

```
Status         deactivating
Delegated      12.5 SOL
Active         12.5 SOL
Deactivating   12.5 SOL
Activation     epoch 880
Deactivation   epoch 912
```

### Status

| Status | Meaning |
| --- | --- |
| `activating` | The stake was delegated and is still warming up. Part of it may already be active |
| `active` | The whole delegation counts toward the validator |
| `deactivating` | The stake was told to stop and is cooling down. It cannot be withdrawn yet |
| `inactive` | The delegation has fully cooled down, or never became active |
| `undelegated` | The account is set up and funded but was never delegated |
| `uninitialized` | The account has no stake data yet |

## List a wallet's stake accounts

```bash
sol-stake-info --wallet 3TH7TndHEF9VDYAgPfNFLdGcsshZmhcDSgVr8VQZEWfd
```

```
Wallet          3TH7TndHEF9VDYAgPfNFLdGcsshZmhcDSgVr8VQZEWfd
Current epoch   912
Stake accounts  3
Total balance   15.00684864 SOL
Active          12.5 SOL
Activating      2 SOL
RPC             api.mainnet-beta.solana.com

Account                                       Status               Balance  Validator    Role
H4iQ8wEYziagrEdVyFFZPNW966nenPjATdxWSWkVa8rz  active       12.50228288 SOL  4VTA...Jb3B  both
53BxD6dpJ88iEJHNj8hBfWMTUfufH3stpaXwgBXErXBJ  activating    2.00228288 SOL  VQ2d...6baU  both
4Ka8P8MKi5dNVNEScwXUtVJG48W7sQZBwWS3CtEmrnWM  undelegated   0.50228288 SOL  -            staker
```

The biggest account comes first. `Role` says how the wallet controls the account: `staker` (picks the validator), `withdrawer` (can take the SOL out) or `both`. Run the single account lookup on any row for the full details. A wallet with no stake accounts prints a short message and exits with `0`.

This needs `getProgramAccounts`, which many public RPC endpoints block or rate limit. If that happens the error says so, and you can point `--rpc` at your own endpoint.

## RPC endpoint

The endpoint is picked in this order: `--rpc`, then the `SOL_STAKE_INFO_RPC` environment variable, then the public mainnet endpoint. Use `--rpc` for devnet or testnet. The public endpoint is rate limited, so use your own RPC for anything serious.

```bash
export SOL_STAKE_INFO_RPC="https://your-rpc.example.com/?api-key=..."
```

```powershell
$env:SOL_STAKE_INFO_RPC = "https://your-rpc.example.com/?api-key=..."
```

Errors only ever print the RPC hostname, so API keys in the URL are not leaked. Requests that get an HTTP 429 are retried with backoff.

## JSON output

`--json` prints the same information as JSON:

```bash
sol-stake-info H4iQ8wEYziagrEdVyFFZPNW966nenPjATdxWSWkVa8rz --json
```

```json
{
  "address": "H4iQ8wEYziagrEdVyFFZPNW966nenPjATdxWSWkVa8rz",
  "type": "delegated",
  "status": "active",
  "epoch": 912,
  "lamports": 12502282880,
  "rentExemptReserve": 2282880,
  "staker": "3TH7TndHEF9VDYAgPfNFLdGcsshZmhcDSgVr8VQZEWfd",
  "withdrawer": "3TH7TndHEF9VDYAgPfNFLdGcsshZmhcDSgVr8VQZEWfd",
  "lockup": null,
  "delegation": {
    "voter": "4VTAsMXyeT43eu1hR3nNsBvvA9hVqLAy6HbRBeS8Jb3B",
    "stake": 12500000000,
    "activationEpoch": 880,
    "deactivationEpoch": null,
    "creditsObserved": 58685367
  },
  "activation": {
    "effective": 12500000000,
    "activating": 0,
    "deactivating": 0
  },
  "rpc": "api.mainnet-beta.solana.com"
}
```

All amounts are lamports (1 SOL is 1,000,000,000). `type` is what the stake program calls the account (`delegated`, `initialized`, `uninitialized`) and `status` is the result described above. `delegation` and `activation` are `null` when the account was never delegated, and `staker`, `withdrawer`, `rentExemptReserve` and `lockup` are `null` for an uninitialized account. `deactivationEpoch` is `null` while the stake has not been told to stop. When a lockup exists, `lockup` has `custodian`, `epoch`, `unixTimestamp` and `inForce`.

With `--wallet` the output has the wallet, the epoch, a count, the totals and one entry per account (the same fields as above plus `role`):

```bash
sol-stake-info --wallet 3TH7TndHEF9VDYAgPfNFLdGcsshZmhcDSgVr8VQZEWfd --json
```

```json
{
  "wallet": "3TH7TndHEF9VDYAgPfNFLdGcsshZmhcDSgVr8VQZEWfd",
  "epoch": 912,
  "count": 1,
  "totals": {
    "lamports": 12502282880,
    "active": 12500000000,
    "activating": 0,
    "deactivating": 0
  },
  "accounts": [
    {
      "address": "H4iQ8wEYziagrEdVyFFZPNW966nenPjATdxWSWkVa8rz",
      "type": "delegated",
      "status": "active",
      "role": "both",
      "lamports": 12502282880,
      "rentExemptReserve": 2282880,
      "staker": "3TH7TndHEF9VDYAgPfNFLdGcsshZmhcDSgVr8VQZEWfd",
      "withdrawer": "3TH7TndHEF9VDYAgPfNFLdGcsshZmhcDSgVr8VQZEWfd",
      "lockup": null,
      "delegation": {
        "voter": "4VTAsMXyeT43eu1hR3nNsBvvA9hVqLAy6HbRBeS8Jb3B",
        "stake": 12500000000,
        "activationEpoch": 880,
        "deactivationEpoch": null,
        "creditsObserved": 58685367
      },
      "activation": {
        "effective": 12500000000,
        "activating": 0,
        "deactivating": 0
      }
    }
  ],
  "rpc": "api.mainnet-beta.solana.com"
}
```

## How the status is worked out

sol-stake-info asks the RPC for the stake account (`getAccountInfo` with parsed data) and the current epoch (`getEpochInfo`). For a delegated account it also reads the stake history sysvar, which records for every recent epoch how much stake in the whole cluster was active, activating and deactivating.

Each epoch the network can only move a limited share of its stake in or out, so a stake that is delegated at the same time as a lot of other stake becomes active in steps. The status comes from the same warmup and cooldown maths the stake program uses: starting at the activation epoch, the account gets its share of what the cluster can activate each epoch, until all of it is active. Deactivation works the same way in reverse. The share is 9% of the cluster's active stake per epoch, which is the rate the stake program applies today.

A stake whose activation epoch is older than the history the cluster keeps (about 512 epochs) is treated as fully active, as the stake program does.

## Good to know

- Amounts are exact lamports. They are shown as SOL without rounding, with trailing zeros dropped
- A lockup holds until both its epoch and its time have passed. The time is compared with your computer's clock, so it can be off by a few seconds. A custodian named in the lockup can still withdraw while it is in force
- Status is worked out for the epoch the RPC reports as current. The next epoch boundary can change it
- Rewards are not shown
- An address that is not a stake account (a wallet, a token account) is reported as such. Use `--wallet` to find the stake accounts of a wallet
- Amounts that cannot be shown exactly (more than about 9 million SOL in a single total) stop with an error instead of being rounded
- A lookup makes two requests, or three when the account is delegated (the account, the epoch and the stake history). `--wallet` makes two `getProgramAccounts` requests plus the epoch, and the stake history when any account is delegated
- Epoch numbers and stake history belong to the cluster your RPC points at. Use `--rpc` for devnet or testnet

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. This includes a wallet that has no stake accounts |
| `1` | The account was not found, is not a stake account or could not be read, or an RPC call failed (with `--wallet`, also when the RPC blocks `getProgramAccounts`) |
| `2` | Usage error (bad or conflicting arguments) |

## Development

```bash
npm test
```

No dependencies to install. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT