
import chai from 'chai'
import FatApi from '../../../sdk/device/fat/FatApi'
import MockTransmitter from '../../../sdk/device/transmit/MockTransmitter'
import FatCache from '../../../sdk/device/fat/FatCache'

chai.should()

const random = (low, high) => {
  return Math.floor(Math.random() * (high - low) + low)
}

describe('FatCache', function () {
  this.timeout(60 * 1000)

  // caution! if you use real device to runing these tests, the fat system will destroied!
  const fatCache = new FatCache(new FatApi(new MockTransmitter()))

  before(async function () {
    await fatCache.init()

    // set all block as used for random access
    let pubBlockNums = Array.apply(null, {length: fatCache.pubBlockNum})
      .map(Function.call, Number)
    let priBlockNums = Array.apply(null, {length: fatCache.priBlockNum})
      .map(Function.call, (value) => fatCache.pubBlockNum + value)
    await fatCache.setUsedBlocks(pubBlockNums)
    await fatCache.setUsedBlocks(priBlockNums)
  })

  it('readBlocks', async function () {
    let count = 1000
    while (count--) {
      let blockNum = random(0, fatCache.pubBlockNum)
      let start = random(0, fatCache.blockSize)
      let length = random(0, fatCache.blockSize - start)
      await fatCache.readBlock(blockNum, start, length)
    }

    count = 1000
    while (count--) {
      let blockNumSize = random(0, fatCache.pubBlockNum)
      let blockNums = []
      while (blockNums.length < blockNumSize) {
        let blockNum = random(blockNums.length, fatCache.pubBlockNum - blockNums.length)
        blockNums.push(blockNum)
      }
      let start = random(0, fatCache.blockSize)
      let length = random(0, blockNumSize * this.blockSize - start)
      length = (length > 0 && length) || 0
      await fatCache.readBlocks(blockNums, start, length)
    }
  })

  it('writeBlocks', async function () {
    let count = 100
    while (count--) {
      let blockNum = random(0, fatCache.pubBlockNum)
      let start = random(0, fatCache.blockSize)
      let length = random(0, fatCache.blockSize - start)

      let data = Buffer.allocUnsafe(length)
      for (let i = 0; i < data.length; i++) {
        data[i] = random(0, 256)
      }
      await fatCache.writeBlock(blockNum, data, start)
    }

    count = 100
    while (count--) {
      let blockNumSize = random(0, fatCache.pubBlockNum)
      let blockNums = []
      while (blockNums.length < blockNumSize) {
        let blockNum = random(blockNums.length, fatCache.pubBlockNum - blockNums.length)
        blockNums.push(blockNum)
      }
      let start = random(0, fatCache.blockSize)
      let length = random(0, blockNumSize * fatCache.blockSize - start)
      length = (length > 0 && length) || 0

      let data = Buffer.allocUnsafe(length)
      for (let i = 0; i < data.length; i++) {
        data[i] = random(0, 256)
      }
      await fatCache.writeBlocks(blockNums, data, start)
    }
  })

  // play ground
  it('readAndwriteBlocks', async function () {
    let blockNums = [135, 39, 72, 13, 14, 15, 16, 17, 18, 19, 20, 133, 134, 11, 12, 121, 112, 113, 114, 70, 71, 59, 60, 52, 42, 29, 120, 55, 56, 57, 127, 128, 129, 5, 69, 1, 2, 3, 4, 131, 132, 111, 24, 25, 26, 27, 49, 6, 7, 106, 50, 51, 44, 34, 92, 93, 31, 32, 89, 90, 91, 82, 83, 84, 85, 86, 87, 88, 126, 96, 97, 98, 75, 0]
    let start = 3851
    let length = 271
    let data = Buffer.allocUnsafe(length)
    for (let i = 0; i < data.length; i++) {
      data[i] = random(0, 256)
    }

    console.warn('test case', start, length, blockNums)
    console.warn('data', data.toString('hex'))
    await fatCache.writeBlocks(blockNums, data, start)
    // first read
    let readData = await fatCache.readBlocks(blockNums, start, length)
    console.warn('readData', readData.toString('hex'))

    // cached read
    readData = await fatCache.readBlocks(blockNums, start, length)
    for (let i = 0; i < length; i++) {
      data[i].should.equal(readData[i])
    }

    // uncached read
    for (let blockNum of blockNums) {
      await fatCache._clearCached(blockNum)
    }
    readData = await fatCache.readBlocks(blockNums, start, length)
    for (let i = 0; i < length; i++) {
      data[i].should.equal(readData[i])
    }
  })

  it('randomReadAndwriteBlocks', async function () {
    let count = 100
    let i = 0
    while (i++ < count) {
      let blockNumSize = random(1, fatCache.pubBlockNum + 1)
      let blockNums = [random(0, fatCache.pubBlockNum)]
      while (blockNums.length < blockNumSize) {
        // 50% chance block is continuous
        let blockNum = blockNums[blockNums.length - 1] + 1
        if (blockNum >= fatCache.pubBlockNum || random(0, 2) === 0) {
          blockNum = random(0, fatCache.pubBlockNum)
        }
        if (!blockNums.includes(blockNum)) {
          blockNums.push(blockNum)
        }
      }
      let start = random(0, blockNumSize * fatCache.blockSize)
      let length = random(0, blockNumSize * fatCache.blockSize - start)

      let data = Buffer.allocUnsafe(length)
      for (let i = 0; i < data.length; i++) {
        data[i] = random(0, 256)
      }

      console.warn('test case', i, start, length, blockNums)
      console.warn('data', data.toString('hex'))
      await fatCache.writeBlocks(blockNums, data, start)

      // first read
      let readData = await fatCache.readBlocks(blockNums, start, length)
      console.warn('readData', readData.toString('hex'))
      for (let i = 0; i < length; i++) {
        data[i].should.equal(readData[i])
      }

      // cached read
      readData = await fatCache.readBlocks(blockNums, start, length)
      console.warn('readData', readData.toString('hex'))
      for (let i = 0; i < length; i++) {
        data[i].should.equal(readData[i])
      }

      // uncached read
      for (let blockNum of blockNums) {
        await fatCache._clearCached(blockNum)
      }
      readData = await fatCache.readBlocks(blockNums, start, length)
      console.warn('readData', readData.toString('hex'))
      for (let i = 0; i < length; i++) {
        data[i].should.equal(readData[i])
      }
    }
  })
})
