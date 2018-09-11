import D from '../../D'
import FatCache from './FatCache'
import {Buffer} from 'buffer'

const fileAttrSize = 17

export default class Fat {
  constructor (fatApi) {
    this._fatCache = new FatCache(fatApi)
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
      fileAttr = await this._createFile(fileName, offset + data.length, isPublic)
    } else if (this._getFileOccupiedSpace(fileAttr) < offset + data.length) {
      // file space not enough
      fileAttr = await this._resizeFile(fileAttr, offset + data.length, isPublic)
    }
    let blockNums = this._getProcessingBlockNums(fileAttr, offset, data.length)
    await this._fatCache.writeBlocks(blockNums, data, offset)
  }

  async deleteFile (fileName, isPublic = true) {
    if (!this._fatCache.isFormat) throw D.error.fatUnavailable
    let fileAttr = await this.findFile(fileName, isPublic)
    if (!fileAttr) {
      console.warn('deleteFile file not exist', fileName)
      throw D.error.fatInvalidFile
    }

    let willUnusedBlockNums = []
    let nextBlockNum = fileAttr.firstBlock
    while (nextBlockNum !== -1) {
      willUnusedBlockNums.append(nextBlockNum)
      nextBlockNum = this._fatCache.nextBlockNum(nextBlockNum)
    }

    // clean file content for safety, still works if don't do this
    let data = Buffer.alloc(willUnusedBlockNums.length * this._fatCache.blockSize)
    await this._fatCache.writeBlocks(willUnusedBlockNums, data)

    // update fat file system info
    await this._fatCache.clearUsedBlocks(willUnusedBlockNums)
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

      let block = await this._fatCache.readBlock(blockNum)
      let fileAttr = Fat._dataToFileAttr(block)
      if (fileAttr.fileName === fileName) {
        console.log('findFile succeed', fileName, fileAttr)
        return fileAttr
      }
    }
    console.log('findFile failed', fileName)
    return null
  }

  /**
   * Enlarge file occupied space. Shrink file not support yet (unecessary for now)
   */
  async _resizeFile (fileAttr, newFileLen, isPublic = true) {
    return this._buildFile(fileAttr.fileName, newFileLen, isPublic, true)
  }

  async _createFile (fileName, fileLen, isPublic = true) {
    return this._buildFile(fileName, fileLen, isPublic, false)
  }

  async _getFileOccupiedSpace (fileAttr) {
    let length = 0
    let nextBlockNum = fileAttr.firstBlock
    while (nextBlockNum !== -1) {
      length += this._fatCache.blockSize
      nextBlockNum = this._fatCache.nextBlockNum(nextBlockNum)
    }
    length -= fileAttrSize + fileAttr.fileNameLen
    return length
  }

  async _buildFile (fileName, fileLen, isPublic, resize) {
    if (!this._fatCache.isFormat) throw D.error.fatUnavailable

    if (fileName.length >= 32) {
      console.warn('file name too long', fileName)
      throw D.error.fatOutOfRange
    }

    let oldFileAttr = await this.findFile(fileName, isPublic)
    if (!resize && oldFileAttr) {
      console.warn('createFile file already exists', fileName)
      throw D.error.fatInvalidFile
    } else if (resize && !oldFileAttr) {
      console.warn('createFile resize, but file not exist', fileName)
      throw D.error.fatInvalidFile
    }

    // if it's resize file, we need to find out the pervious last block to connect the new blocks
    let prevBlockNum = resize ? -1 : oldFileAttr.firstBlock
    if (resize) {
      let nextBlockNum = oldFileAttr.firstBlock
      while (nextBlockNum !== -1) {
        prevBlockNum = nextBlockNum
        nextBlockNum = this._fatCache.nextBlockNum(nextBlockNum)
      }
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
      while (
        currentBlockNum < needBlockLen &&
        currentBlockNum < endBlockNum &&
        !this._fatCache.isUsed(currentBlockNum)) {
        currentBlockNum++
      }
      if (currentBlockNum === endBlockNum) {
        console.warn('create file out of space', fileName, fileLen, needBlockLen)
        throw D.error.fatOutOfSpace
      }

      willUsedBlocks.append(currentBlockNum)
      startBlockNum = currentBlockNum + 1
    }

    let fileAttr
    let firstBlock
    if (resize) {
      fileAttr = oldFileAttr
      firstBlock = fileAttr.firstBlock
    } else {
      // write fileAttr
      // here we don't use fileId for search, so make it constant
      const fileId = 0xffff
      firstBlock = willUsedBlocks[0]
      fileAttr = {
        fileId: fileId,
        fileType: isPublic ? 0x01 : 0x02,
        firstBlock: firstBlock,
        fileSize: fileLen,
        fileState: 0x5A,
        fileNameLen: fileName.length,
        rfu: Buffer.alloc(1),
        fileName: fileName
      }
    }

    let fileAttrData = Fat._fileAttrToData(fileAttr)
    await this._fatCache.writeBlock(firstBlock, fileAttrData)

    // update fat file system info
    await this._fatCache.setUsedBlocks(willUsedBlocks, prevBlockNum)
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

  static _dataToFileAttr (data) {
    return {
      fileType: data.readUInt32LE(0x00),
      fileSize: data.readUInt32LE(0x04),
      fileId: data.readUInt16LE(0x08),
      firstBlock: data.readUInt32LE(0x0a),
      fileState: data[0x0e],
      fileNameLen: data[0x0f],
      rfu: data[0x10],
      fileName: String.fromCharCode.apply(null, data.slice(0x11, data[15]))
    }
  }

  static _fileAttrToData (fileAttr) {
    let data = Buffer.allocUnsafe(0x11 + fileAttr.fileNameLen)
    data.writeUInt32LE(fileAttr.fileType, 0x00)
    data.writeUInt32LE(fileAttr.fileSize, 0x04)
    data.writeUInt16LE(fileAttr.fileId, 0x08)
    data.writeUInt32LE(fileAttr.firstBlock, 0x0a)
    data.writeUInt8(fileAttr.fileState, 0x0e)
    data.writeUInt8(fileAttr.fileNameLen, 0x0f)
    data.writeUInt8(fileAttr.rfu, 0x10)
    data.write(fileAttr.fileName, 0x11, fileAttr.fileNameLen)
  }
}
