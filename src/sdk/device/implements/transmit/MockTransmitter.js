import D from '../../../D'

const fileSize = 10 * 1024 // 0x2800

/**
 * Mock object of transmitter. Only enabled when D.test.mockTransmitter = true
 */
export default class MockTransmitter {
  constructor () {
    this.currentFileId = 0
    this.file = {
      pub: Buffer.alloc(fileSize),
      pri: Buffer.alloc(fileSize)
    }
    // bitmap = 0x28, fat = 0x280, pub = 0x2200, pri = 0x2800, blockSize = 0x40
    // pubBlockNum = 136, priBlockNum = 160
    let fatHead = Buffer.from(
      '00000000000000000000000000000000' +
      '00000000000000000000000000000000' +
      '00000000000000000000000000000000' +
      '00000000000000000000288002002200' +
      '00002800004000000000000000000000' +
      '00000000000000000000000000000000' +
      '00000000000000000000000000000000' +
      '00000000000000000000000000000000' +
      '00000000000000000000000000000000' +
      '00000000000000AA5500000000000000', 'hex')
    fatHead.copy(this.file.pub)
  }

  listenPlug (callback) {
    if (D.test.mockTransmitter) {
      D.dispatch(() => callback(D.error.ok, D.status.plugIn))
    }
  }

  sendApdu (apdu) {
    let hexApdu = apdu.toString('hex').toUpperCase()
    console.debug('mock apdu', hexApdu)

    // fat command
    // select fileId
    if (hexApdu.startsWith('00A4000002')) {
      let fileId = (apdu[0x05] << 8) + apdu[0x06]
      if (fileId !== 0x1EA8 && fileId !== 0x1000) {
        console.warn('mock select fileId invalid', hexApdu, fileId.toString(16))
        throw D.error.deviceProtocol
      }
      this.currentFileId = fileId
      return
    }

    // read file
    if (hexApdu.startsWith('80B0')) {
      let offset = (apdu[0x02] << 8) + apdu[0x03]
      let length = (apdu[0x05] << 8) + apdu[0x06]
      if (offset + length > fileSize) {
        console.warn('mock read file out of range', hexApdu)
        throw D.error.deviceProtocol
      }

      let data
      if (this.currentFileId === 0x1EA8) {
        data = this.file.pub
      } else if (this.currentFileId === 0x1000) {
        data = this.file.pri
      }
      if (!data) {
        console.warn('mock read file file not selected', hexApdu, this.currentFileId)
        throw D.error.deviceProtocol
      }

      return data.slice(offset, offset + length)
    }

    // write file
    if (hexApdu.startsWith('80D6')) {
      let offset = (apdu[0x02] << 8) + apdu[0x03]
      let length = (apdu[0x05] << 8) + apdu[0x06]
      if (offset + length > fileSize) {
        console.warn('mock write file out of range', hexApdu)
        throw D.error.deviceProtocol
      }

      let data
      if (this.currentFileId === 0x1EA8) {
        data = this.file.pub
      } else if (this.currentFileId === 0x1000) {
        data = this.file.pri
      }
      if (!data) {
        console.warn('mock read file file not selected', hexApdu, this.currentFileId)
        throw D.error.deviceProtocol
      }

      apdu.slice(0x07, apdu.length).copy(data, offset)
      return
    }

    // global info (part of)
    if (hexApdu.startsWith('803300000DBB0B')) {
      return Buffer.from('000004000400', 'hex') // max read / write size = 1k
    }

    console.warn('not supported mock apdu', apdu)
    throw D.error.unknown
  }
}
MockTransmitter.fileSize = fileSize
