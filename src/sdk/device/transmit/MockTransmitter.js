import D from '../../D'

const fileSize = 10 * 1024 // 0x2800

export default class MockTransmitter {
  listenPlug (callback) {
    D.dispatch(() => callback(D.error.ok, D.status.plugIn))
    this.currentFileId = 0
    this.file = {
      pub: Buffer.alloc(fileSize),
      pri: Buffer.alloc(fileSize)
    }
  }

  sendApdu (apdu) {
    let hexApdu = apdu.toString('hex')

    // fat command
    // select fileId
    if (hexApdu.startsWith('00A4000002')) {
      let fileId = (apdu[0x05] << 8) + apdu[0x06]
      if (fileId !== 0x1EA8 || fileId !== 0x1000) {
        console.warn('mock select fileId invalid', hexApdu)
        throw D.error.deviceProtocol
      }
      this.currentFileId = fileId
      return
    }

    // read file
    if (hexApdu.startsWith('80B0')) {
      let offset = (apdu[0x02] << 8) + apdu[0x03]
      let length = (apdu[0x05] << 8) + apdu[0x06]
      if (offset + length >= fileSize) {
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

      return data.slice(offset, length)
    }

    // write file
    if (hexApdu.startsWith('80D6')) {
      let offset = (apdu[0x02] << 8) + apdu[0x03]
      let length = (apdu[0x05] << 8) + apdu[0x06]
      if (offset + length >= fileSize) {
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

      apdu.copy(data, offset, 0x07, apdu.length)
    }

    // global info (part of)
    if (hexApdu.startsWith('803300000DBB0B')) {
      return Buffer.from('000004000400', 'hex')
    }
  }
}
