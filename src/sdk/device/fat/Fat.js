import D from '../../D'
import FatCache from './FatCache'

const fileAttrSize = 17

export default class Fat {
  constructor (fatApi) {
    this._fatCache = new FatCache()
  }

  async init () {
    await this._fatCache.init()
  }

  async readFile (fileName, offset = 0, length = 0, isPublic = true) {
    if (!this._fatCache.isFormat) throw D.error.fatUnavailable

    let fileAttr = await this.findFile(fileName, isPublic)
    if (!fileAttr) return null
    // if don't provided length, default all the file
    if (length <= 0) {
      length = fileAttr.fileSize
    }

    let blockNums = this._getProcessingBlockNums(fileAttr, offset, length)

    offset += fileAttrSize + fileAttr.fileNameLen
    return this._fatCache.readBlocks(blockNums, offset, length)
  }

  async writeFile (fileName, data, offset = 0, isPublic = true) {
    if (!this._fatCache.isFormat) throw D.error.fatUnavailable

    let fileAttr = await this.findFile(fileName, isPublic)

    if (!fileAttr) {
      // no file
      fileAttr = await this.createFile(fileName, offset + data.length, isPublic)
    } else if (fileAttr.fileSize < offset + data.length) {
      // data size out of range
      // TODO
    }
    let blockNums = this._getProcessingBlockNums(fileAttr, 0, 0)
    await this._fatCache.writeBlocks(blockNums, data, offset)
  }

  async createFile (fileName, fileLen, isPublic = true) {
    if (!this._fatCache.isFormat) throw D.error.fatUnavailable

    // don't use fileId
    let fileId = 0xffff
    if (fileName.length >= 32) {
      console.warn('file name too long', fileName)
      throw D.error.fatOutOfRange
    }

    let fileAttr = await this.findFile(fileName, isPublic)
    if (fileAttr) {
      console.warn('file already exists', fileName)
    }

    let needBlockLen = Math.ceil((fileAttrSize + fileName.length + fileLen) / this._fatCache.blockSize)
    // let file size be times of 2 * blockSize, to make fat less fragment
    needBlockLen += needBlockLen % 2

    let startBlockNum = isPublic ? 0 : this._fatCache.pubBlockNum
    let blockLen = isPublic ? this._fatCache.pubBlockNum : this._fatCache.priBlockNum
    let endBlockNum = startBlockNum + blockLen
    let currentBlockNum = startBlockNum

    let willUsedBlocks = []
    while (willUsedBlocks.length < needBlockLen) {
      // find unused block
      while (!this._fatCache.isUsed(currentBlockNum) && currentBlockNum < endBlockNum) {
        currentBlockNum++
      }
      if (currentBlockNum === endBlockNum) {
        console.warn('create file out of space', fileName, fileLen, needBlockLen)
        throw D.error.fatOutOfSpace
      }

      willUsedBlocks.append(currentBlockNum)
      startBlockNum = currentBlockNum + 1
    }
  }

  _getProcessingBlockNums (fileAttr, offset, length) {
    if (!this._fatCache.isFormat) throw D.error.fatUnavailable

    if (offset + length > fileAttr.fileSize) {
      console.warn('readWriteFile params out of range', offset, length, fileAttr)
      throw D.error.fatOutOfRange
    }

    // add pendding of fileAttr and fileName
    offset += fileAttrSize + fileAttr.fileNameLen

    // read / write size
    let dataLength = offset & (this._fatCache.blockSize - 0x01)
    let blockNum = fileAttr.firstBlock
    let remainOffset = offset
    while (remainOffset && blockNum >= 0) {
      remainOffset -= dataLength
      blockNum = this._fatCache.nextBlockNum(blockNum)
      dataLength = this._fatCache.blockSize
    }
    if (remainOffset !== 0) {
      console.warn('readWriteFile offset out of range, not match fileAttr.fileSize', offset, length, fileAttr)
      throw D.error.fatInvalidFile
    }

    let handledLength = 0
    let blockNums = []
    while (handledLength < length && blockNum > 0) {
      blockNums.append(blockNum)
      blockNum = this._fatCache.nextBlockNum(blockNum)
      handledLength += dataLength
      let remainLength = length - handledLength
      dataLength = remainLength > this._fatCache.blockSize ? this._fatCache.blockSize : remainLength
    }
    if (handledLength !== length) {
      console.warn('readWriteFile length out of range, not match fileAttr.fileSize', offset, length, fileAttr)
      throw D.error.fatInvalidFile
    }

    return blockNums
  }

  async findFile (fileName, isPublic = true) {
    if (!this._fatCache.isFormat) throw D.error.fatUnavailable

    let startBlockNum = isPublic ? 0 : this._fatCache.pubBlockNum
    let blockLen = isPublic ? this._fatCache.pubBlockNum : this._fatCache.priBlockNum
    let endBlockNum = startBlockNum + blockLen

    for (let blockNum = startBlockNum; blockNum < endBlockNum; blockNum++) {
      if (!this._fatCache.isFirstBlock(blockNum)) {
        continue
      }
      if (!this._fatCache.isUsed(blockNum)) {
        continue
      }
      let fileAttr = await this._fatCache.getFileAttr(blockNum)
      if (fileAttr.fileName === fileName) {
        console.log('findFile succeed', fileName, fileAttr)
        return fileAttr
      }
    }
    console.log('findFile failed', fileName)
    return null
  }
}
