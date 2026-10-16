'use strict';

// Port of the stake program's warmup/cooldown maths (Delegation::stake_activating_and_deactivating).
// The program itself treats the 9% rate as if it had applied from epoch 0, because it only needs
// the stake of the current epoch, so this does the same.
const WARMUP_COOLDOWN_RATE = 0.09;

// d: delegation from fetchStakeAccount (activationEpoch null = bootstrap, deactivationEpoch null = never)
// history: Map of epoch -> { effective, activating, deactivating }, cluster-wide
function effectiveAndActivating(d, targetEpoch, history) {
  const delegated = d.stake;
  const activation = d.activationEpoch;
  const deactivation = d.deactivationEpoch === null ? Infinity : d.deactivationEpoch;

  if (activation === null) return { effective: delegated, activating: 0 };
  if (activation === deactivation) return { effective: 0, activating: 0 };
  if (targetEpoch === activation) return { effective: 0, activating: delegated };
  if (targetEpoch < activation) return { effective: 0, activating: 0 };

  let prev = history.get(activation);
  // No history for the activation epoch: it is too old to matter, so the stake is fully effective.
  if (!prev) return { effective: delegated, activating: 0 };

  let prevEpoch = activation;
  let effective = 0;
  for (;;) {
    const currentEpoch = prevEpoch + 1;
    if (prev.activating === 0) break;

    const weight = (delegated - effective) / prev.activating;
    const newlyEffectiveCluster = prev.effective * WARMUP_COOLDOWN_RATE;
    effective += Math.max(Math.floor(weight * newlyEffectiveCluster), 1);

    if (effective >= delegated) {
      effective = delegated;
      break;
    }
    if (currentEpoch >= targetEpoch || currentEpoch >= deactivation) break;

    const next = history.get(currentEpoch);
    if (!next) break;
    prevEpoch = currentEpoch;
    prev = next;
  }
  return { effective, activating: delegated - effective };
}

function statusOf({ effective, activating, deactivating }) {
  if (deactivating > 0) return 'deactivating';
  if (activating > 0) return 'activating';
  if (effective > 0) return 'active';
  return 'inactive';
}

// Resolves to { status, effective, activating, deactivating } (lamports) at targetEpoch.
function stakeActivation(d, targetEpoch, history) {
  const { effective, activating } = effectiveAndActivating(d, targetEpoch, history);
  const deactivation = d.deactivationEpoch === null ? Infinity : d.deactivationEpoch;

  let amounts;
  if (targetEpoch < deactivation) {
    amounts = { effective, activating, deactivating: 0 };
  } else if (targetEpoch === deactivation) {
    // Only what has become effective can be deactivating.
    amounts = { effective, activating: 0, deactivating: Math.min(effective, d.stake) };
  } else {
    let prev = history.get(deactivation);
    if (!prev) {
      // No history for the deactivation epoch: assume fully deactivated.
      amounts = { effective: 0, activating: 0, deactivating: 0 };
    } else {
      let prevEpoch = deactivation;
      let current = effective;
      for (;;) {
        const currentEpoch = prevEpoch + 1;
        if (prev.deactivating === 0) break;

        const weight = current / prev.deactivating;
        const newlyNotEffectiveCluster = prev.effective * WARMUP_COOLDOWN_RATE;
        current = Math.max(current - Math.max(Math.floor(weight * newlyNotEffectiveCluster), 1), 0);

        if (current === 0) break;
        if (currentEpoch >= targetEpoch) break;

        const next = history.get(currentEpoch);
        if (!next) break;
        prevEpoch = currentEpoch;
        prev = next;
      }
      amounts = { effective: current, activating: 0, deactivating: current };
    }
  }

  return { status: statusOf(amounts), ...amounts };
}

// info: fetchStakeAccount(...) result
// Resolves to { epoch, status, activation, lockup } where lockup gains inForce.
function deriveStatus(info, { epoch, history, now }) {
  let status;
  let activation = null;

  if (info.delegation) {
    const result = stakeActivation(info.delegation, epoch, history);
    status = result.status;
    activation = {
      effective: result.effective,
      activating: result.activating,
      deactivating: result.deactivating,
    };
  } else if (info.type === 'initialized') {
    status = 'undelegated';
  } else {
    status = info.type;
  }

  // A lockup holds until both its epoch and its time have passed (unless the custodian signs).
  const lockup = info.lockup
    ? { ...info.lockup, inForce: info.lockup.unixTimestamp > now || info.lockup.epoch > epoch }
    : null;

  return { epoch, status, activation, lockup };
}

module.exports = { WARMUP_COOLDOWN_RATE, stakeActivation, deriveStatus };