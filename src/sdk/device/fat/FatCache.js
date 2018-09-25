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
    if (!isFormat) {
      console.warn('fat is not format')
      throw D.error.fatUnavailable
    }

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
    console.debug('fat cache', this)

    // loadFatData:
    // BlkFatHead + rfu + bipmap + bimapbackup + fat
    let response = await this._fatApi.readFile(fatHeadSize, rfuSize + fatHead.bitmapSize * 2 + fatHead.fatSize)
    response.copy(this.bitmap, 0, rfuSize, fatHead.bitmapSize)
    response.copy(this.bitmapBackup, 0, rfuSize + fatHead.bitmapSize, fatHead.bitmapSize)
    response.copy(this.fat, 0, rfuSize + fatHead.bitmapSize * 2, fatHead.fatSize)
  }

  async readBlock (blockNum, start = 0, length = undefined) {
    length = length === undefined ? this.blockSize : length
    return this.readBlocks([blockNum], start, length)
  }

  // read blocks, blocks must be all public or all private
  async readBlocks (blockNums, start, length) {
    if (!blockNums || blockNums.length === 0) {
      return
    }

    if (start + length > blockNums.length * this.blockSize) {
      console.warn('start + read length > provided blocks size', start, length, blockNums.length)
      throw D.error.fatOutOfRange
    }

    // skip the blocks that don't need to read
    let startIndex = 0
    while (start > this.blockSize) {
      start -= this.blockSize
      startIndex++
    }
    let endIndex = startIndex
    while (length > (endIndex - startIndex) * this.blockSize) {
      endIndex++
    }
    endIndex += 1
    blockNums = blockNums.slice(startIndex, endIndex)

    let isPublic = await this._selectBigFileForBlockNums(blockNums)
    let cacheData = isPublic ? this.pubData : this.priData

    for (let blockNum of blockNums) {
      if (!this.isUsed(blockNum)) {
        console.warn('try to read unused block')
        throw D.error.fatUnavailable
      }
    }

    // cache all the blocks
    for (let index = 0; index < blockNums.length;) {
      let blockNum = blockNums[index]
      if (this._isCached(blockNum)) {
        index++
        continue
      }

      // find continuous uncached blocks in one time for better proformance
      let continuousBlockSize = 1
      while (index + continuousBlockSize < blockNums.length) {
        let newIndex = index + continuousBlockSize
        if (blockNums[newIndex] !== blockNums[newIndex - 1] + 1) {
          break
        }
        if (this._isCached(newIndex)) {
          break
        }
        continuousBlockSize++
      }

      // read from device
      let deviceFileOffset = this._getBlockOffsetInDevice(blockNum)
      let response = await this._fatApi.readFile(deviceFileOffset, continuousBlockSize * this.blockSize)
      console.debug('readBlocks read uncached', continuousBlockSize, index, blockNum, response.toString('hex'))

      // update cache
      let cacheOffset = blockNum * this.blockSize
      response.copy(cacheData, cacheOffset)
      index += continuousBlockSize
      while (continuousBlockSize--) {
        this._setCached(blockNum++)
      }
    }

    let data = Buffer.allocUnsafe(length)
    let blockOffset = start
    let remainLength = length
    for (let blockNum of blockNums) {
      let realBlockNum = isPublic ? blockNum : (blockNum - this.pubBlockNum)
      let readBlockLength = this.blockSize - blockOffset
      readBlockLength = Math.max(readBlockLength, 0)
      readBlockLength = Math.min(readBlockLength, remainLength)

      let cacheOffset = realBlockNum * this.blockSize + blockOffset
      console.debug('readBlocks copy cached', blockOffset, length - remainLength,
        cacheData.slice(cacheOffset, cacheOffset + readBlockLength).toString('hex'))
      cacheData.slice(cacheOffset, cacheOffset + readBlockLength)
        .copy(data, length - remainLength)

      blockOffset = 0
      remainLength -= readBlockLength
    }

    return data
  }

  async writeBlock (blockNum, data, start = 0) {
    return this.writeBlocks([blockNum], data, start)
  }

  // write blocks, blocks must be all public or all private
  async writeBlocks (blockNums, data, start = 0) {
    if (!blockNums || blockNums.length === 0) {
      return
    }

    if (start + data.length > blockNums.length * this.blockSize) {
      console.warn('start + data.length > provided blocks size')
      throw D.error.fatOutOfRange
    }

    // skip the blocks that don't need to write
    let startIndex = 0
    while (start > this.blockSize) {
      start -= this.blockSize
      startIndex++
    }
    let endIndex = startIndex
    while (data.length > (endIndex - startIndex) * this.blockSize) {
      endIndex++
    }
    endIndex += 1
    blockNums = blockNums.slice(startIndex, endIndex)

    let isPublic = await this._selectBigFileForBlockNums(blockNums)
    let cacheData = isPublic ? this.pubData : this.priData

    for (let blockNum of blockNums) {
      if (!this.isUsed(blockNum)) {
        console.warn('try to write unused block')
        throw D.error.fatUnavailable
      }
    }

    // write all the blocks data to device
    let index = 0
    let dataOffset = 0
    while (dataOffset < data.length) {
      // find continuous blocks and write in one time for better proformance
      let continuousBlockSize = 1
      while (index + continuousBlockSize < blockNums.length) {
        let newIndex = index + continuousBlockSize
        if (blockNums[newIndex] !== blockNums[newIndex - 1] + 1) {
          break
        }
        continuousBlockSize++
      }

      // write to device
      let continuousDataLength = continuousBlockSize * this.blockSize - start
      continuousDataLength = Math.min(continuousDataLength, data.length - dataOffset)

      let continuousData = data.slice(dataOffset, dataOffset + continuousDataLength)
      let blockNum = blockNums[index]
      let deviceFileOffset = this._getBlockOffsetInDevice(blockNum)
      console.debug('writeBlocks write', start, index, blockNum, dataOffset, continuousData.toString('hex'))
      await this._fatApi.writeFile(deviceFileOffset + start, continuousData)

      // update cache
      let cacheOffset = blockNum * this.blockSize
      continuousData.copy(cacheData, cacheOffset + start)

      // set cached flag
      // caution: if a block is not cached, and we are not fully write the block:
      // 1. start != 0
      // 2. (length - start) !== n * blockSize, n >= 1
      // this block will miss some part of data
      // in this case, we can not _setCached() for this block
      let wroteLength = continuousDataLength
      let currentBlockOffset = start
      let remainBlockSize = continuousBlockSize
      while (remainBlockSize > 0) {
        if (currentBlockOffset === 0 && wroteLength >= this.blockSize) {
          this._setCached(blockNum)
        }
        wroteLength -= this.blockSize - currentBlockOffset
        currentBlockOffset = 0
        blockNum++
        remainBlockSize--
      }

      dataOffset += continuousDataLength
      index += continuousBlockSize
      start = 0
    }
  }

  async setUsedBlocks (willUsedBlockNums, prevBlockNum = -1) {
    if (!willUsedBlockNums || willUsedBlockNums.length === 0) {
      return
    }

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

      if (prevBlockNum === -1) {
        this._setFirstBlock(firstBlock)
      } else {
        this._setNextBlock(prevBlockNum, firstBlock)
      }
      for (let i = 0; i < length - 1; i++) {
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
        this._clearNextBlock(blockNum)
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
    await this._fatApi.writeFile(fatOffset, this.fat.slice(minBlockNum * 2, (maxBlockNum + 1) * 2))

    // update bitmap & bitmap backup, part of update
    let minBitmapIndex = minBlockNum << 3
    let maxBitmapIndex = maxBlockNum << 3
    let bitmapOffset = fatHeadSize + rfuSize + minBitmapIndex
    let bitmapBackupOffset = fatHeadSize + rfuSize + this.bitmap.length + minBitmapIndex
    await this._fatApi.writeFile(bitmapOffset,
      this.bitmap.slice(minBitmapIndex, Math.ceil(maxBitmapIndex + 1)))
    await this._fatApi.writeFile(bitmapBackupOffset,
      this.bitmapBackup.slice(minBitmapIndex, Math.ceil(maxBitmapIndex + 1)))
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
   * pubData & priData shares fat flag data: bitmap, bitmapBackup, readFlag, fat
   * so when pubData block 0, blockNum = 0; block = 1, blockNum = 1
   * and priData block = 0, blockNum = pubBlockNum; block = 1, blockNum = pubBlockNum + 1
   */
  isFirstBlock (blockNum) {
    let fatFlag = this.fat.readUInt16LE(blockNum * 2)
    return fatFlag & 0x8000
  }

  isLastBlock (blockNum) {
    let fatFlag = this.fat.readUInt16LE(blockNum * 2)
    return (fatFlag & 0x3fff) === 0x3fff
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
    let fatFlag = this.fat.readUInt16LE(blockNum * 2)
    this.fat.writeUInt16LE((fatFlag & 0xc000) + nextBlockNum, blockNum * 2)
  }

  _clearNextBlock (blockNum) {
    this.fat.writeUInt16LE(0x0000, blockNum * 2)
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
