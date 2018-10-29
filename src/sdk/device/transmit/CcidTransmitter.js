import Provider from '../../Provider'
import D from '../../D'
import {Buffer} from 'buffer'

/**
 * Esecubit USB CCID protocol
 */
export default class CcidTransmitter {
  constructor () {
    const Device = Provider.getUsbDevice()
    this._device = new Device()
    this._seqNum = 0

    this._plugListener = () => {}
    this._device.listenPlug((error, status) => {
      D.dispatch(() => this._plugListener(error, status))
    })
  }

  listenPlug (callback) {
    if (callback) this._plugListener = callback
  }

  /**
   * APDU encrypt & decrypt
   */
  async sendApdu (apdu, isEnc = false) {
    // currently S300 APDU encryption not supported
    return this._sendApdu(apdu)
  }

  /**
   * APDU special response handling
   */
  async _sendApdu (apdu) {
    let {result, response} = await this._transmit(apdu)

    // device busy
    while (result === 0x9060) {
      let waitCmd = Buffer.from('000c0000000', 'hex')
      let {_result, _response} = await this._transmit(waitCmd)
      result = _result
      response = _response
    }

    CcidTransmitter._checkSw1Sw2(result)
    return response
  }

  /**
   * CCID command pack & unpack
   */
  async _transmit (apdu) {
    if (typeof apdu === 'string') {
      apdu = Buffer.from(apdu, 'hex')
    }

    const packCcidCmd = (seqNum, apdu) => {
      let cmdHead = Buffer.from('6F000000000000000000', 'hex')
      cmdHead.writeUInt32LE(apdu.length, 0x01)
      cmdHead[6] = seqNum
      return Buffer.concat([cmdHead, apdu])
    }

    const sendAndReceive = async (pack) => {
      const packRecvCcidCmd = (seqNum) => {
        const levelParameter = 0x0010
        let cmd = Buffer.from('62000000000000000000', 'hex')
        cmd[0x06] = seqNum
        cmd.writeUInt16LE(levelParameter, 0x08)
        return cmd
      }

      await this._device.send(pack)

      let result = Buffer.alloc(0)
      while (true) {
        let received = await this._device.receive()
        if (!received || received.length < 0x0A || received[0] !== 0x80) {
          console.warn('CCID receive package invalid', received && received.toString('hex'))
          throw D.error.deviceProtocol
        }
        let recvLen = received.readUInt32LE(0x01)
        result = Buffer.concat([result, received.slice(0x0A, 0x0A + recvLen)])

        let finish = received[0x09] !== 0x01 && received[0x09] !== 0x03
        if (finish) break

        let respPack = packRecvCcidCmd(this._seqNum++)
        received = await this._device.send(respPack)
      }
      let indexSw1Sw2 = result.length - 2
      let sw1sw2 = (result[indexSw1Sw2] << 8) + result[indexSw1Sw2 + 1]
      return {result: sw1sw2, response: result.slice(0, indexSw1Sw2)}
    }

    this._seqNum = 0
    console.debug('transmit send apdu', apdu.toString('hex'))
    let sendPack = packCcidCmd(this._seqNum++, apdu)
    let response = await sendAndReceive(sendPack)
    console.debug('transmit got response', response.result.toString(16), response.response.toString('hex'))
    return response
  }

  static _checkSw1Sw2 (sw1sw2) {
    let errorCode = D.error.checkSw1Sw2(sw1sw2)
    if (errorCode !== D.error.succeed) throw errorCode
  }
}
