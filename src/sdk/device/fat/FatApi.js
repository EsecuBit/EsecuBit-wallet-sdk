import {Buffer} from 'buffer'
import D from '../../D'

export default class FatApi {
  constructor (transmitter) {
    this._transmitter = transmitter
    this._allEnc = true
    this._globalInfo = null
  }

  async selectFile (fileId) {
    let apdu = Buffer.alloc(0x07)
    Buffer.from('00A4000002', 'hex').copy(apdu)
    apdu[0x05] = (fileId >> 8) & 0xff
    apdu[0x06] = fileId & 0xff

    await this._sendApdu(apdu)
  }

  async readFile (offset, size) {
    if (offset >= 0x010000 || size >= 0x010000) {
      console.warn('readFile out of range', offset, size)
      throw D.error.deviceProtocol
    }

    let {maxReadSize} = await this._getGlobalInfo()
    let apdu = Buffer.alloc(0x07)
    Buffer.from('80B0000000', 'hex').copy(apdu)

    let fileData = Buffer.alloc(size)
    let remainReadSize = size
    let currentOffset = offset
    while (remainReadSize) {
      let readSize = remainReadSize > maxReadSize ? maxReadSize : remainReadSize
      apdu[0x02] = (currentOffset >> 8) & 0xff
      apdu[0x03] = currentOffset & 0xff
      apdu[0x05] = (readSize >> 8) & 0xff
      apdu[0x06] = readSize & 0xff

      let response = await this._sendApdu(apdu)
      remainReadSize -= readSize
      currentOffset += readSize

      let readLength = currentOffset - offset
      response.copy(fileData, readLength)
    }

    return fileData
  }

  async writeFile (data, offset) {
    let size = data.length
    if (offset >= 0x010000 || size >= 0x010000) {
      console.warn('writeFile out of range', offset, size)
      throw D.error.deviceProtocol
    }

    let {maxWriteSize} = await this._getGlobalInfo()
    let apdu = Buffer.alloc(0x07 + maxWriteSize)
    Buffer.from('80D6000000', 'hex').copy(apdu)

    let remainWriteSize = size
    let currentOffset = offset
    while (remainWriteSize) {
      let writeSize = remainWriteSize > maxWriteSize ? maxWriteSize : remainWriteSize
      apdu[0x02] = (currentOffset >> 8) & 0xff
      apdu[0x03] = currentOffset & 0xff
      apdu[0x05] = (writeSize >> 8) & 0xff
      apdu[0x06] = writeSize & 0xff

      let wroteLength = currentOffset - offset
      data.slice(wroteLength, writeSize).copy(apdu, 0x07)
      await this._sendApdu(apdu.slice(0, 0x07 + writeSize))

      remainWriteSize -= writeSize
      currentOffset += writeSize
    }
  }

  async _getGlobalInfo () {
    if (this._globalInfo) {
      return this._globalInfo
    }

    let apduLen = 0x12
    let apdu = Buffer.alloc(apduLen)
    // cos version always >= 0x0205
    Buffer.from('803300000DBB0B', 'hex').copy(apdu)

    let response = await this._sendApdu(apdu)
    this._globalInfo = {
      maxReadSize: (response[0x02] << 8) + response[0x03],
      maxWriteSize: (response[0x04] << 8) + response[0x05]
    }
    return this._globalInfo
  }

  _sendApdu (apdu, isEnc = false) {
    return this._transmitter.sendApdu(apdu, this._allEnc || isEnc)
  }
}
