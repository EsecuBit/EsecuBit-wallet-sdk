import D from '../../D'
import {Buffer} from 'buffer'

// little-endian
const readShort = (data, offset) => {
  return data[offset] + (data[offset + 1] << 8)
}

const setShort = (data, offset, value) => {
  data[offset] = value & 0xff
  data[offset + 1] = (value >> 8) & 0xff
}

// little-endian
const readInt = (data, offset) => {
  return data[offset] +
    (data[offset + 1] << 8) +
    (data[offset + 2] << 16) +
    (data[offset + 3] << 24)
}

const fatHeadSize = 0xE1
const pubFileId = 0x1EA8
const priFileId = 0x1000

export default class FatCache {
  constructor (fatApi) {
    this._fatApi = fatApi
    this.isFormat = false
  }

  async init () {
    await this._fatApi.selectFile(pubFileId)

    let fatHeadData = await this._fatApi.readFile(0x00, fatHeadSize)
    let fatHead = {
      majorVersion: readShort(fatHeadData, 0x00),
      minorVersion: readShort(fatHeadData, 0x02),
      flag: readInt(fatHeadData, 0x04),
      bitmapSize: fatHeadData[0x3A],
      fatSize: readShort(fatHeadData, 0x3B),
      pubDataSize: readInt(fatHeadData, 0x3D),
      priDataSize: readInt(fatHeadData, 0x41),
      blockSize: readShort(fatHeadData, 0x45),
      formatFlag: readShort(fatHeadData, 0x97)
    }
    console.debug('fat head', fatHead)

    let isFormat = readShort(fatHeadData, 0x97) === 0x55AA
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
      // BlkFatHead + 256 retain + bipmap + bimapbackup + fat
      let response = await this._fatApi.readFile(fatHeadSize, 256 + fatHead.bitmapSize * 2 + fatHead.fatSize)
      response.copy(this.bitmap, 0, 256, fatHead.bitmapSize)
      response.copy(this.bitmapBackup, 0, 256 + fatHead.bitmapSize, fatHead.bitmapSize)
      response.copy(this.fat, 0, 256 + fatHead.bitmapSize * 2, fatHead.fatSize)
    }
  }

  /**
   * pubData & priData shares flag data: bitmap, bitmapBackup, readFlag, fat
   * so when pubData block 0, blockNum = 0; block = 1, blockNum = 1
   * and priData block = 0, blockNum = pubBlockNum; block = 1, blockNum = pubBlockNum + 1
   */
  isFirstBlock (blockNum) {
    let fatFlag = readShort(this.fat, blockNum * 2)
    return fatFlag & 0x8000
  }

  setFirstBlock (blockNum) {
    let fatFlag = readShort(this.fat, blockNum * 2)
    setShort(this, blockNum * 2, fatFlag | 0x8000)
  }

  isLastBlock (blockNum) {
    let fatFlag = readShort(this.fat, blockNum * 2)
    return fatFlag === (fatFlag & 0x3FFF)
  }

  setLastBlock (blockNum) {
    let fatFlag = readShort(this.fat, blockNum * 2)
    setShort(this, blockNum * 2, fatFlag | 0x3FFF)
  }

  setNextBlock (blockNum, nextBlockNum) {
    this.fat[blockNum] = nextBlockNum
  }

  nextBlockNum (blockNum) {
    if (blockNum === 0x3fff) {
      return -1
    }
    let fatFlag = readShort(this.fat, blockNum * 2)
    return fatFlag & 0x3fff
  }

  isUsed (blockNum) {
    return (this.bitmap[blockNum >> 3] & (0x01 << (blockNum & 0x07))) !== 0
  }

  setUsed (blockNum) {
    this.bitmap[blockNum >> 3] |= 0x01 << (blockNum & 0x07)
  }

  clearUsed (blockNum) {
    this.bitmap[blockNum >> 3] &= ~(0x01 << (blockNum & 0x07)) & 0xff
  }

  isCached (blockNum) {
    return (this.readFlag[blockNum >> 3] & (0x01 << (blockNum & 0x07))) !== 0
  }

  setCached (blockNum) {
    this.readFlag[blockNum >> 3] |= 0x01 << (blockNum & 0x07)
  }

  clearCached (blockNum) {
    this.readFlag[blockNum >> 3] &= ~(0x01 << (blockNum & 0x07)) & 0xff
  }

  async readBlock (blockNum, start = 0, length = 0) {
    length = length || this.blockSize
    return this.readBlocks([blockNum], start, length)
  }

  // read continuous blocks, blocks must be all public or all private
  async readBlocks (blockNums, start, length) {
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
    let data = isPublic ? this.pubData : this.priData

    for (let i = 0; i < blockNums.length;) {
      let blockNum = blockNums[i]
      let realBlockNum = isPublic ? blockNum : (blockNum - this.pubBlockNum)
      let offset = realBlockNum * this.blockSize

      if (this.isCached(blockNum)) {
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

      let response = await this._fatApi.readFile(offset, continuousBlockSize * this.blockSize)
      response.copy(data, offset)
      i += continuousBlockSize
      while (continuousBlockSize--) {
        this.setCached(blockNum++)
      }
    }

    let firstBlockNum = blockNums[0]
    let realFirstBlockNum = isPublic ? firstBlockNum : (firstBlockNum - this.pubBlockNum)
    let firBlockOffset = realFirstBlockNum * this.blockSize
    return data.slice(firBlockOffset + start, length)
  }

  async writeBlock (blockNum, data, start = 0) {
    return this.writeBlocks([blockNum], data, start)
  }

  // write continuous blocks, blocks must be all public or all private
  async writeBlocks (blockNums, data, start) {
    if (start > this.blockSize) {
      console.warn('writeBlocks start > fat block size', blockNums, data, start)
      throw D.error.fatOutOfRange
    }

    let isPublic = blockNums[0] < this.pubBlockNum
    for (let blockNum of blockNums) {
      let isPublicBlock = blockNum < this.pubBlockNum
      if (isPublic !== isPublicBlock) {
        console.warn('readBlocks blocks not all public or all private')
        throw D.error.fatOutOfRange
      }
    }

    // choose file
    let fileId = isPublic ? pubFileId : priFileId
    if (this.currentFileId !== fileId) {
      await this._fatApi.selectFile(fileId)
      this.currentFileId = fileId
    }

    for (let i = 0; i < blockNums.length;) {
      let blockNum = blockNums[i]
      let realBlockNum = isPublic ? blockNum : (blockNum - this.pubBlockNum)
      let offset = realBlockNum * this.blockSize

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

      await this._fatApi.writeFile(
        data.slice(i * this.blockSize, continuousBlockSize * this.blockSize - start), offset + start)
      i += continuousBlockSize
      start = 0
    }
  }

  async updateUsedBlocks (willUsedBlockNums) {
    let length = willUsedBlockNums.length
    let firstBlock = willUsedBlockNums[0]
    let lastBlock = willUsedBlockNums[willUsedBlockNums.length - 1]

    this.setUsed(firstBlock)
    this.setFirstBlock(firstBlock)
    this.setNextBlock(willUsedBlockNums[0], willUsedBlockNums[1])
    for (let i = 1; i < length - 1; i++) {
      this.setUsed(willUsedBlockNums[i])
      this.setNextBlock(willUsedBlockNums[i], willUsedBlockNums[i + 1])
    }
    this.setUsed(lastBlock)
    this.setLastBlock(lastBlock)

    // update fat
    if (this.currentFileId !== pubFileId) {
      await this._fatApi.selectFile(pubFileId)
    }
    await this._fatApi.writeFile()
    // update bitmap
  }

  async getFileAttr (blockNum) {
    let block = await this.readBlock(blockNum)
    return {
      fileType: readInt(block, 0),
      fileSize: readInt(block, 4),
      fileId: readShort(block, 8),
      firstBlock: readInt(block, 10),
      fileState: block[14],
      fileNameLen: block[15],
      rfu: block[16],
      fileName: String.fromCharCode.apply(null, block.slice(17, block[15]))
    }
  }
}
