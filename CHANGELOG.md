# Changelog

## [0.1.0] - 2026-10-16

First release.

### Added
- Look up a stake account: balance, delegated amount, validator (vote account), activation and deactivation epochs, rent reserve, staker, withdrawer and lockup. Works for delegated, initialized and uninitialized accounts
- Status (`inactive`, `activating`, `active`, `deactivating`, `undelegated` or `uninitialized`) with the active, activating and deactivating amounts, worked out with the stake program's warmup and cooldown maths from the current epoch and the stake history sysvar. The stake history is only fetched for delegated accounts
- Lockup reported as in force or expired, comparing its epoch and time with the current epoch and your computer's clock
- `--wallet <address>` lists every stake account a wallet controls as staker or withdrawer, with status, balance, validator and role per account, the biggest first, and totals. It makes two `getProgramAccounts` queries and merges them. If the RPC blocks or limits that method, the error says to use `--rpc` with your own endpoint
- `--json` output for a single account and for `--wallet`
- RPC client with 429 retry and backoff, `--rpc` and `SOL_STAKE_INFO_RPC`, hostname-only error messages
- Exit codes: `0` ok, `1` not found, not a stake account or RPC failure, `2` usage error