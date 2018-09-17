import D from './D'

/**
 * device has limit of apdu data length = 2k, support up to 45 inputs + 2 outputs
 * we set a algorithm here:
 * 1. follow bnb algorithm:
 *    https://github.com/bitcoin/bitcoin/blob/6f5372a1714383bb5e47a5ba89dc4d93020a2943/src/wallet/coinselection.cpp
 * 2. if tx length exceed the limit, recalculate utxos and use utxos as few as possible
 * 3. if tx length exceed the limit with the least utxos, and return an warning field
 */
function getEnoughUtxo (utxos, presetUtxos, outputs, feeRate, sendAll) {
  const maxApduDataLength = 2000
  const apduDataHead = 55
  const calculateApduLength = (utxos, outputSize) => {
    let maxToBeSignedOutputScriptLength = utxos.reduce((max, utxo) => Math.max(max, utxo.script.length / 2), 0)
    return apduDataHead + utxos.length * 41 + outputSize * 34 + maxToBeSignedOutputScriptLength
  }

  let proposalBnb
  if (!sendAll) {
    proposalBnb = _coinSelectBnb(utxos, presetUtxos, outputs, feeRate, sendAll)
  }
  if (proposalBnb) {
    let apduDataLength = calculateApduLength(proposalBnb.willSpentUtxos, outputs.length)
    if (apduDataLength <= maxApduDataLength) {
      return proposalBnb
    }
  }

  // recalculate utxos and use utxos as few as possible
  utxos = utxos.sort((a, b) => b.value - a.value) // sort max => min
  let proposalClassic = _coinSelectClassic(utxos, presetUtxos, outputs, feeRate, sendAll)
  if (calculateApduLength(proposalClassic.willSpentUtxos, outputs.length) <= maxApduDataLength) {
    return proposalClassic
  }

  // with limit of apdu data = 2k
  // and outputscript that going to spent using p2pkh,
  // and output.length = 2, then maxInputSize = 45
  let maxInputSize = 45
  while (calculateApduLength(utxos.slice(0, maxInputSize), outputs.length) > maxApduDataLength) {
    maxInputSize--
  }
  if (maxInputSize <= 0) {
    console.warn('too many outputs that no space for inputs in apdu')
    throw D.error.tooManyOutputs
  }

  utxos = utxos.slice(0, maxInputSize)
  let proposalLimit = _coinSelectClassic(utxos, presetUtxos, outputs, feeRate, true)
  proposalLimit.deviceLimit = true
  return proposalLimit
}

// calculate tx length using compressed public key size
function calculateFee (utxos, outputs, feeRate, needChange) {
  let outputSize = outputs.length + needChange ? 1 : 0
  // input length range = [147, 148], use larger one here
  let txLength = 10 + 148 * utxos.length + 34 * outputSize
  return txLength * feeRate
}

function _coinSelectBnb (utxos, presetUtxos, outputs, feeRate, sendAll) {
  // TODO implement bnb algorithm

  // this simple algorithm will use utxo as much as possible
  // to reduce utxo amount when utxos.length >= 20
  if (utxos.length <= 20) {
    return null
  }
  utxos = utxos.sort((a, b) => a.value - b.value) // sort min => max
  try {
    return _coinSelectClassic(utxos, presetUtxos, outputs, feeRate, sendAll)
  } catch (e) {
    console.warn('_coinSelectBnb', e)
    return null
  }
}

function _coinSelectClassic (utxos, presetUtxos, outputs, feeRate, sendAll) {
  let totalOut = outputs.reduce((sum, output) => output.value + sum, 0)
  let totalAvailable = utxos.reduce((sum, utxo) => utxo.value + sum, 0) +
    presetUtxos.reduce((sum, utxo) => utxo.value + sum, 0)

  let fee = 0
  while (true) {
    if (totalAvailable < fee + totalOut) throw D.error.balanceNotEnough

    // noinspection JSUnresolvedVariable
    let {totalUtxo, willSpentUtxos} = _getEnoughUtxo(utxos, presetUtxos, totalOut + fee, sendAll)
    // new fee calculated
    fee = calculateFee(willSpentUtxos, outputs, feeRate, totalOut + fee === totalUtxo)
    if (totalUtxo >= totalOut + fee) {
      return {willSpentUtxos, fee}
    }
    // new fee + total out is larger than new total, calculate again
  }
}

function _getEnoughUtxo (utxos, presetUtxos, total, sendAll) {
  let willSpentUtxos = Array.from(presetUtxos)
  let totalUtxo = willSpentUtxos.reduce((sum, utxo) => utxo.value + sum, 0)

  for (let utxo of utxos) {
    if (!sendAll && totalUtxo >= total) {
      break
    }
    totalUtxo += utxo.value
    willSpentUtxos.push(utxo)
  }
  if (totalUtxo < total) {
    throw D.error.balanceNotEnough
  }
  return {totalUtxo, willSpentUtxos}
}

export default {
  getEnoughUtxo
}
