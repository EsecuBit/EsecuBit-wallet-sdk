import D from '../../D'
import FatCache from './FatCache'
import {Buffer} from 'buffer'

const fileAttrSize = 17
const maxFileNameLength = 32

/**
 * Fat is a little-endian file system.
 */
export default class Fat {
  constructor (fatApi) {
    this._fatCache = new FatCache(fatApi)
  }

  async init () {
    await this._fatCache.init()
  }

  /**
   * read file data.
   */
  async readFile (fileName, offset = 0, length = -1, isPublic = true) {
    if (!this._fatCache.isFormat) throw D.error.fatUnavailable

    let fileAttr = await this.findFile(fileName, isPublic)
    if (!fileAttr) throw D.error.fatFileNotExists
    // if don't provide length, default to the end of file
    if (length < 0) {
      length = fileAttr.fileSize - offset
    }

    let {startOffset, blockNums} = this._getProcessingBlockNums(fileAttr, offset, length)

    return this._fatCache.readBlocks(blockNums, startOffset, length)
  }

  /**
   * write file data. auto create if not exist
   */
  async writeFile (fileName, data, offset = 0, isPublic = true) {
    if (!this._fatCache.isFormat) throw D.error.fatUnavailable

    let fileAttr = await this.findFile(fileName, isPublic)
    if (!fileAttr) {
      // no file
      fileAttr = await this.createFile(fileName, offset + data.length, isPublic)
    } else if (fileAttr.fileSize < offset + data.length) {
      // fileSize not enough
      fileAttr = await this._resizeFile(fileAttr, offset + data.length, isPublic)
    }
    let {startOffset, blockNums} = this._getProcessingBlockNums(fileAttr, offset, data.length)

    await this._fatCache.writeBlocks(blockNums, data, startOffset)
  }

  async createFile (fileName, fileSize, isPublic = true) {
    return this._buildFile(fileName, fileSize, isPublic, false)
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
      willUnusedBlockNums.push(nextBlockNum)
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
        console.debug('findFile succeed', fileName, fileAttr)
        return fileAttr
      }
    }
    console.debug('findFile failed', fileName)
    return null
  }

  /**
   * Enlarge file occupied space. Shrink file will be ignore (keep current file size)
   */
  async _resizeFile (fileAttr, newfileSize, isPublic = true) {
    return this._buildFile(fileAttr.fileName, newfileSize, isPublic, true)
  }

  _getFileOccupiedBlocks (fileAttr) {
    let nextBlockNum = fileAttr.firstBlock
    let blockNums = []
    while (nextBlockNum !== -1) {
      blockNums.push(nextBlockNum)
      nextBlockNum = this._fatCache.nextBlockNum(nextBlockNum)
    }
    console.debug('_getFileOccupiedBlocks', fileAttr, blockNums)
    return blockNums
  }

  async _buildFile (fileName, fileSize, isPublic, resize) {
    if (!this._fatCache.isFormat) throw D.error.fatUnavailable

    if (fileName.length > maxFileNameLength) {
      console.warn('file name too long', fileName)
      throw D.error.fatInvalidFile
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
    let prevBlockNum = resize ? oldFileAttr.firstBlock : -1
    if (resize) {
      let nextBlockNum = oldFileAttr.firstBlock
      while (nextBlockNum !== -1) {
        prevBlockNum = nextBlockNum
        nextBlockNum = this._fatCache.nextBlockNum(nextBlockNum)
      }
    }

    let needBlockLen = Math.ceil((fileAttrSize + fileName.length + fileSize) / this._fatCache.blockSize)
    // let file size be the times of 2 * blockSize, to make fat less fragment
    needBlockLen += needBlockLen % 2
    console.debug('needBlockLen', needBlockLen, fileAttrSize + fileName.length, fileSize)
    if (resize) {
      let oldBlocks = this._getFileOccupiedBlocks(oldFileAttr)
      let oldBlockLen = oldBlocks.length
      if (needBlockLen <= oldBlockLen) {
        console.debug('no need to enlarge fat file occupied space', oldFileAttr, oldBlockLen, needBlockLen)
        needBlockLen = 0
      } else {
        console.debug(`enlarge fat file occupied space from ${oldBlockLen} to ${needBlockLen}`, oldFileAttr)
        needBlockLen -= oldBlockLen
      }
    }

    let startBlockNum = isPublic ? 0 : this._fatCache.pubBlockNum
    let blockLen = isPublic ? this._fatCache.pubBlockNum : this._fatCache.priBlockNum
    let endBlockNum = startBlockNum + blockLen
    let currentBlockNum = startBlockNum

    let willUsedBlocks = []
    while (willUsedBlocks.length < needBlockLen) {
      // find unused block
      while (
        currentBlockNum < endBlockNum &&
        this._fatCache.isUsed(currentBlockNum)) {
        currentBlockNum++
      }
      if (currentBlockNum === endBlockNum) {
        console.warn('create file out of space', fileName, resize, fileSize, needBlockLen, willUsedBlocks)
        throw D.error.fatOutOfSpace
      }

      willUsedBlocks.push(currentBlockNum)
      currentBlockNum++
    }

    let fileAttr
    let firstBlock
    if (resize) {
      fileAttr = oldFileAttr
      fileAttr.fileSize = fileSize
      firstBlock = fileAttr.firstBlock
    } else {
      // write fileAttr
      // here we don't use fileId, so make it constant
      const fileId = 0xffff
      firstBlock = willUsedBlocks[0]
      fileAttr = {
        fileId: fileId,
        fileType: isPublic ? 0x01 : 0x02,
        firstBlock: firstBlock,
        fileSize: fileSize,
        fileState: 0x5A,
        fileNameLen: fileName.length,
        rfu: 0x00,
        fileName: fileName
      }
    }

    let fileAttrData = Fat._fileAttrToData(fileAttr)

    // update fat file system info
    await this._fatCache.setUsedBlocks(willUsedBlocks, prevBlockNum)

    await this._fatCache.writeBlock(firstBlock, fileAttrData)
    console.debug(`${resize ? 'resizeFile' : 'createFile'} ${fileName} with blocks [${willUsedBlocks}]`)

    return fileAttr
  }

  _getProcessingBlockNums (fileAttr, offset, length) {
    if (!this._fatCache.isFormat) throw D.error.fatUnavailable

    if (offset + length > fileAttr.fileSize) {
      console.warn('readWriteFile fileSize too small, offset + length > fileAttr.fileSize', offset, length, fileAttr)
      throw D.error.fatOutOfRange
    }

    // add pendding of fileAttr and fileName
    let dataOffset = offset + fileAttrSize + fileAttr.fileNameLen

    // find startBlockNum
    let startBlockNum = fileAttr.firstBlock
    let startOffset = dataOffset
    while (startOffset > this._fatCache.blockSize && startBlockNum !== -1) {
      startOffset -= this._fatCache.blockSize
      startBlockNum = this._fatCache.nextBlockNum(startBlockNum)
    }
    if (startBlockNum === -1) {
      console.warn('readWriteFile offset out of range', offset, length, fileAttr)
      throw D.error.fatInvalidFile
    }

    // find processing blockNums
    let handledLength = 0
    let blockNums = []
    let currentBlockNum = startBlockNum
    let subDataLength = this._fatCache.blockSize - startOffset
    while (handledLength < length && currentBlockNum !== -1) {
      blockNums.push(currentBlockNum)
      currentBlockNum = this._fatCache.nextBlockNum(currentBlockNum)
      handledLength += Math.min(subDataLength, length)
      let remainLength = length - handledLength
      subDataLength = Math.min(this._fatCache.blockSize, remainLength)
    }
    if (handledLength !== length) {
      console.warn('readWriteFile length out of range', offset, length, handledLength, startBlockNum, fileAttr)
      throw D.error.fatInvalidFile
    }

    console.debug('processing blockNums', offset, length, fileAttr)
    return {startOffset, blockNums}
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
      fileName: String.fromCharCode.apply(null, data.slice(0x11, 0x11 + data[0x0f]))
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
    return data
  }
}
Fat.fileAttrSize = fileAttrSize
Fat.maxFileNameLength = maxFileNameLength
