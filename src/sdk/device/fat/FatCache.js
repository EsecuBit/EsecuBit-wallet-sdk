import D from '../../D'
import {Buffer} from 'buffer'

const fatHeadSize = 0xE1
const pubFileId = 0x1EA8
const priFileId = 0x1000
const rfuSize = 256

export default class FatCache {
  constructor (fatApi) {
    this._fatApi = fatApi
    this.isFormat = false
  }

  async init () {
    await this._fatApi.selectFile(pubFileId)

    let fatHeadData = await this._fatApi.readFile(0x00, fatHeadSize)
    let fatHead = {
      majorVersion: fatHeadData.readUInt16LE(0x00),
      minorVersion: fatHeadData.readUInt16LE(0x02),
      flag: fatHeadData.readUInt32LE(0x04),
      bitmapSize: fatHeadData[0x3A],
      fatSize: fatHeadData.readUInt16LE(0x3B),
      pubDataSize: fatHeadData.readUInt32LE(0x3D),
      priDataSize: fatHeadData.readUInt32LE(0x41),
      blockSize: fatHeadData.readUInt16LE(0x45),
      formatFlag: fatHeadData.readUInt16LE(0x97)
    }
    console.debug('fat head', fatHead)

    let isFormat = fatHeadData.readUInt16LE(0x97) === 0x55AA
    if (isFormat) {
      this.isFormat = true
      this.blockSize = fatHead.blockSize
      this.pubBlockNum = fatHead.pubDataSize / fatHead.blockSize
      this.priBlockNum = fatHead.priDataSize / fatHead.blockSize
      this.bitmap = Buffer.allocUnsafe(fatHead.bitmapSize)
      this.bitmapBackup = Buffer.allocUnsafe(fatHead.bitmapSize)
      this.readFlag = Buffer.alloc(fatHead.bitmapSize)
      this.fat = Buffer.allocUnsafe(fatHead.fatSize)
      this.pubData = Buffer.allocUnsafe(fatHead.pubDataSize)
      this.priData = Buffer.allocUnsafe(fatHead.priDataSize)
      this.currentFileId = pubFileId

      // loadFatData:
      // BlkFatHead + rfu + bipmap + bimapbackup + fat
      let response = await this._fatApi.readFile(fatHeadSize, rfuSize + fatHead.bitmapSize * 2 + fatHead.fatSize)
      response.copy(this.bitmap, 0, rfuSize, fatHead.bitmapSize)
      response.copy(this.bitmapBackup, 0, rfuSize + fatHead.bitmapSize, fatHead.bitmapSize)
      response.copy(this.fat, 0, rfuSize + fatHead.bitmapSize * 2, fatHead.fatSize)
    }
  }

  async readBlock (blockNum, start = 0, length = 0) {
    length = length || this.blockSize
    return this.readBlocks([blockNum], start, length)
  }

  // read continuous blocks, blocks must be all public or all private
  async readBlocks (blockNums, start, length) {
    let isPublic = await this._selectBigFileForBlockNums(blockNums)
    let cacheData = isPublic ? this.pubData : this.priData

    // cache all the blocks
    for (let i = 0; i < blockNums.length;) {
      let blockNum = blockNums[i]
      // skip cached block
      if (this._isCached(blockNum)) {
        i++
        continue
      }

      // find continuous uncached blocks to improve proformance
      let nextBlockNum = blockNum
      let continuousBlockSize = 1
      while (nextBlockNum !== -1) {
        let nextNextBlockNum = this.nextBlockNum(nextBlockNum)
        if (nextNextBlockNum !== nextBlockNum + 1) {
          break
        }
        nextBlockNum = nextNextBlockNum
        continuousBlockSize++
      }

      // read from device
      let deviceFileOffset = this._getBlockOffsetInDevice(blockNum * this.blockSize)
      let response = await this._fatApi.readFile(deviceFileOffset, continuousBlockSize * this.blockSize)

      // update cache
      let cacheOffset = blockNum * this.blockSize
      response.copy(cacheData, cacheOffset)
      i += continuousBlockSize
      while (continuousBlockSize--) {
        this._setCached(blockNum++)
      }
    }

    let firstBlockNum = blockNums[0]
    let realFirstBlockNum = isPublic ? firstBlockNum : (firstBlockNum - this.pubBlockNum)
    let firBlockOffset = realFirstBlockNum * this.blockSize
    return cacheData.slice(firBlockOffset + start, length)
  }

  async writeBlock (blockNum, data, start = 0) {
    return this.writeBlocks([blockNum], data, start)
  }

  // write continuous blocks, blocks must be all public or all private
  async writeBlocks (blockNums, data, start = 0) {
    let isPublic = await this._selectBigFileForBlockNums(blockNums)
    let cacheData = isPublic ? this.pubData : this.priData

    // write all the blocks data to device
    for (let i = 0; i < blockNums.length;) {
      let blockNum = blockNums[i]

      // find continuous uncached blocks to improve proformance
      let nextBlockNum = blockNum
      let continuousBlockSize = 1
      while (nextBlockNum !== -1) {
        let nextNextBlockNum = this.nextBlockNum(nextBlockNum)
        if (nextNextBlockNum !== nextBlockNum + 1) {
          break
        }
        nextBlockNum = nextNextBlockNum
        continuousBlockSize++
      }

      // write to device
      let continuousData = data.slice(i * this.blockSize, continuousBlockSize * this.blockSize - start)
      let deviceFileOffset = this._getBlockOffsetInDevice(blockNum)
      await this._fatApi.writeFile(continuousData, deviceFileOffset + start)

      // update cache
      let cacheOffset = blockNum * this.blockSize
      continuousData.copy(cacheData, cacheOffset + start)
      i += continuousBlockSize

      // caution: if a block is not cached, and we are not fully write the block:
      // 1. start != 0
      // 2. (length - start) !== n * blockSize, n >= 1
      // this block will miss some part of data
      // in this case, we can not _setCached for this block
      let wroteLength = continuousData.length
      let currentBlockOffset = start
      while (continuousBlockSize > 0) {
        if (currentBlockOffset === 0 && wroteLength >= this.blockSize) {
          this._setCached(blockNum)
        }
        wroteLength -= this.blockSize - currentBlockOffset
        currentBlockOffset = 0
        blockNum++
        continuousBlockSize--
      }

      start = 0
    }
  }

  async setUsedBlocks (willUsedBlockNums, prevBlockNum = -1) {
    await this._selectBigFileForBlockNums(willUsedBlockNums)

    let backup = {
      fat: Buffer.from(this.fat),
      bitmap: Buffer.from(this.bitmap),
      bitmapBackup: Buffer.from(this.bitmapBackup)
    }

    try {
      let length = willUsedBlockNums.length
      let firstBlock = willUsedBlockNums[0]
      let lastBlock = willUsedBlockNums[willUsedBlockNums.length - 1]

      this._setUsed(firstBlock)
      if (prevBlockNum !== -1) {
        this._setFirstBlock(firstBlock)
      } else {
        this._setNextBlock(prevBlockNum, firstBlock)
      }
      this._setNextBlock(willUsedBlockNums[0], willUsedBlockNums[1])
      for (let i = 1; i < length - 1; i++) {
        this._setUsed(willUsedBlockNums[i])
        this._setNextBlock(willUsedBlockNums[i], willUsedBlockNums[i + 1])
      }
      this._setUsed(lastBlock)
      this._setLastBlock(lastBlock)

      await this._updateFatFileSystem(willUsedBlockNums)
    } catch (e) {
      console.warn('setUsedBlocks _updateFatFileSystem failed, fall back', e)
      this.fat = backup.fat
      this.bitmap = backup.bitmap
      this.bitmapBackup = backup.bitmapBackup

      throw e
    }
  }

  async clearUsedBlocks (willUnusedBlockNums) {
    await this._selectBigFileForBlockNums(willUnusedBlockNums)

    let backup = {
      fat: Buffer.from(this.fat),
      bitmap: Buffer.from(this.bitmap),
      bitmapBackup: Buffer.from(this.bitmapBackup)
    }

    try {
      for (let blockNum of willUnusedBlockNums) {
        this._clearUsed(blockNum)
        this._setNextBlock(blockNum, 0x0000)
        this._clearCached(blockNum)
      }
      await this._updateFatFileSystem(willUnusedBlockNums)
    } catch (e) {
      console.warn('clearUsedBlocks _updateFatFileSystem failed, fall back', e)
      this.fat = backup.fat
      this.bitmap = backup.bitmap
      this.bitmapBackup = backup.bitmapBackup

      throw e
    }
  }

  async _updateFatFileSystem (blockNums) {
    let minBlockNum = blockNums.reduce((blockNum, min) => Math.min(blockNum, min), blockNums[0])
    let maxBlockNum = blockNums.reduce((blockNum, max) => Math.max(blockNum, max), blockNums[0])

    // update fat, part of update
    let fatOffset = fatHeadSize + rfuSize + this.bitmap.length + this.bitmapBackup.length + minBlockNum * 2
    await this._fatApi.writeFile(this.fat.slice(minBlockNum * 2, (maxBlockNum - minBlockNum + 1) * 2), fatOffset)

    // update bitmap & bitmap backup, part of update
    let minBitmapIndex = minBlockNum << 3
    let maxBitmapIndex = maxBlockNum << 3
    let bitmapOffset = fatHeadSize + rfuSize + minBitmapIndex
    let bitmapBackupOffset = fatHeadSize + rfuSize + this.bitmap.length + minBitmapIndex
    await this._fatApi.writeFile(
      this.bitmap.slice(minBitmapIndex, Math.ceil(maxBitmapIndex - minBitmapIndex + 1)), bitmapOffset)
    await this._fatApi.writeFile(
      this.bitmapBackup.slice(minBitmapIndex, Math.ceil(maxBitmapIndex - minBitmapIndex + 1)), bitmapBackupOffset)
  }

  _getBlockOffsetInDevice (blockNum) {
    if (blockNum >= this.pubBlockNum) {
      // private data
      // block 0 ... block priBlockNum - 1
      blockNum -= this.pubBlockNum
      return blockNum * this.blockSize
    } else {
      // public data
      // fatHead + rfu + bitmap + bipmapBakcup fat + + block 0 ... block pubBlockNum - 1
      let offset = fatHeadSize + rfuSize + this.bitmap.length + this.bitmapBackup.length + this.fat.length
      return offset + blockNum * this.blockSize
    }
  }

  /**
   * check block numbers and select relative file
   *
   * @return boolean, true if blockNums is all public, false if all private
   * @exception blockNums is not all public blocks nor all private blocks
   */
  async _selectBigFileForBlockNums (blockNums) {
    let isPublic = blockNums[0] < this.pubBlockNum
    for (let blockNum of blockNums) {
      let isPublicBlock = blockNum < this.pubBlockNum
      if (isPublic !== isPublicBlock) {
        console.warn('readBlocks blocks not all public or all private')
        throw D.error.fatOutOfRange
      }
    }

    // choose file and data
    let fileId = isPublic ? pubFileId : priFileId
    if (this.currentFileId !== fileId) {
      await this._fatApi.selectFile(fileId)
      this.currentFileId = fileId
    }

    return isPublic
  }

  /**
   * pubData & priData shares flag data: bitmap, bitmapBackup, readFlag, fat
   * so when pubData block 0, blockNum = 0; block = 1, blockNum = 1
   * and priData block = 0, blockNum = pubBlockNum; block = 1, blockNum = pubBlockNum + 1
   */
  isFirstBlock (blockNum) {
    let fatFlag = this.fat.readUInt16LE(blockNum * 2)
    return fatFlag & 0x8000
  }

  isLastBlock (blockNum) {
    let fatFlag = this.fat.readUInt16LE(blockNum * 2)
    return fatFlag === (fatFlag & 0x3fff)
  }

  nextBlockNum (blockNum) {
    if (this.isLastBlock(blockNum)) {
      return -1
    }
    let fatFlag = this.fat.readUInt16LE(blockNum * 2)
    return fatFlag & 0x3fff
  }

  _setFirstBlock (blockNum) {
    let fatFlag = this.fat.readUInt16LE(blockNum * 2)
    this.fat.writeUInt16LE(fatFlag | 0x8000, blockNum * 2)
  }

  _setLastBlock (blockNum) {
    let fatFlag = this.fat.readUInt16LE(blockNum * 2)
    this.fat.writeUInt16LE(fatFlag | 0x3fff, blockNum * 2)
  }

  _setNextBlock (blockNum, nextBlockNum) {
    this.fat[blockNum] = nextBlockNum
  }

  isUsed (blockNum) {
    return (this.bitmap[blockNum >> 3] & (0x01 << (blockNum & 0x07))) !== 0
  }

  _setUsed (blockNum) {
    this.bitmap[blockNum >> 3] |= 0x01 << (blockNum & 0x07)
  }

  _clearUsed (blockNum) {
    this.bitmap[blockNum >> 3] &= ~(0x01 << (blockNum & 0x07)) & 0xff
  }

  _isCached (blockNum) {
    return (this.readFlag[blockNum >> 3] & (0x01 << (blockNum & 0x07))) !== 0
  }

  _setCached (blockNum) {
    this.readFlag[blockNum >> 3] |= 0x01 << (blockNum & 0x07)
  }

  _clearCached (blockNum) {
    this.readFlag[blockNum >> 3] &= ~(0x01 << (blockNum & 0x07)) & 0xff
  }
}
