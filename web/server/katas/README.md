# Cursor CoderPad Practice Katas

This bundle contains:

- `specs/` — one markdown spec per kata
- `*.test.ts` — no-deps TypeScript tests + tiny harness (`test_harness.ts`, `test_utils.ts`)

## Expected implementation file layout
The test files assume you will implement each kata in a sibling TS module at:

- `01_cdc_chunker.ts` exporting `Chunker`
- `02_sliding_window_latency.ts` exporting the required class
- `03_token_bucket_limiter.ts` exporting `TokenBucketLimiter`
- `04_singleflight_cache.ts` exporting `SingleFlightCache` and `ApiError`
- `05_merkle_snapshot.ts` exporting `MerkleSnapshot`

If you name files differently, edit the import at the top of each `*.test.ts`.

## Running
If you have `tsx` installed:

```bash
  npx tsx 01_cdc_chunker.test.ts
```
