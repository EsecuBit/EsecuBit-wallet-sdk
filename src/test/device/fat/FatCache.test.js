
import chai from 'chai'
import FatApi from '../../../sdk/device/implements/fat/FatApi'
import MockTransmitter from '../../../sdk/device/implements/transmit/MockTransmitter'
import FatCache from '../../../sdk/device/implements/fat/FatCache'

chai.should()

describe('FatCache', function () {
  this.timeout(10 * 60 * 1000)

  // caution! if you use real device to runing these tests, the fat system will be destroied!
  const fatCache = new FatCache(new FatApi(new MockTransmitter()))

  function random (low, high) {
    return Math.floor(Math.random() * (high - low) + low)
  }

  function randomData (length) {
    let data = Buffer.allocUnsafe(length)
    for (let i = 0; i < data.length; i++) {
      data[i] = random(0, 256)
    }
    return data
  }

  function randomBlock (isPublic) {
    let blockCount = isPublic ? fatCache.pubBlockNum : fatCache.priBlockNum
    let blockNum = random(0, blockCount)
    blockNum = isPublic ? blockNum : (blockNum + fatCache.pubBlockNum)
    let start = random(0, fatCache.blockSize)
    let length = random(0, fatCache.blockSize - start)
    return {blockNum, start, length}
  }

  function randomBlocks (isPublic) {
    let blockCount = isPublic ? fatCache.pubBlockNum : fatCache.priBlockNum

    let blockNumSize = random(1, blockCount + 1)
    let firstBlock = random(0, blockCount)
    firstBlock = isPublic ? firstBlock : (firstBlock + fatCache.pubBlockNum)
    let blockNums = [firstBlock]
    while (blockNums.length < blockNumSize) {
      // 50% chance that block is continuous
      let blockNum = blockNums[blockNums.length - 1] + 1
      if (blockNum >= blockCount || random(0, 2) === 0) {
        blockNum = random(0, blockCount)
        blockNum = isPublic ? blockNum : (blockNum + fatCache.pubBlockNum)
      }
      if (!blockNums.includes(blockNum)) {
        blockNums.push(blockNum)
      }
    }
    let start = random(0, blockNumSize * fatCache.blockSize)
    let length = random(0, blockNumSize * fatCache.blockSize - start)
    return {blockNums, start, length}
  }

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
    let count = 100
    for (let i = 0; i < count; i++) {
      let {blockNum, start, length} = randomBlock(true)
      await fatCache.readBlock(blockNum, start, length)
    }
    for (let i = 0; i < count; i++) {
      let {blockNum, start, length} = randomBlock(false)
      await fatCache.readBlock(blockNum, start, length)
    }

    for (let i = 0; i < count; i++) {
      let {blockNums, start, length} = randomBlocks(true)
      await fatCache.readBlocks(blockNums, start, length)
    }
    for (let i = 0; i < count; i++) {
      let {blockNums, start, length} = randomBlocks(false)
      await fatCache.readBlocks(blockNums, start, length)
    }
  })

  it('writeBlocks', async function () {
    let count = 100
    for (let i = 0; i < count; i++) {
      let {blockNum, start, length} = randomBlock(true)
      let data = randomData(length)
      await fatCache.writeBlock(blockNum, data, start)
    }
    for (let i = 0; i < count; i++) {
      let {blockNum, start, length} = randomBlock(false)
      let data = randomData(length)
      await fatCache.writeBlock(blockNum, data, start)
    }

    for (let i = 0; i < count; i++) {
      let {blockNums, start, length} = randomBlocks(true)
      let data = randomData(length)
      await fatCache.writeBlocks(blockNums, data, start)
    }
    for (let i = 0; i < count; i++) {
      let {blockNums, start, length} = randomBlocks(false)
      let data = randomData(length)
      await fatCache.writeBlocks(blockNums, data, start)
    }
  })

  // play ground
  it('readAndwriteBlocks', async function () {
    let blockNums = [244, 264, 196, 146, 147, 200, 211, 223, 207, 279, 167, 277, 293, 142, 143, 144, 145, 205, 239, 172, 294, 187, 255, 212, 254, 216, 188, 265]
    let start = 0
    let length = 843
    let data = randomData(length)

    console.warn('test case', start, length, blockNums)
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
  })

  it('randomReadAndwriteBlocks', async function () {
    let count = 100
    for (let i = 0; i < count; i++) {
      let {blockNums, start, length} = randomBlocks(true)
      let data = randomData(length)

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

    for (let i = 0; i < count; i++) {
      let {blockNums, start, length} = randomBlocks(false)
      let data = randomData(length)

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
