import D from '../../../D'
import {Buffer} from 'buffer'
import MockDevice from './io/MockDevice'
import ChromeUsbDevice from './io/ChromeUsbDevice'

/**
 * Esecubit USB CCID protocol
 */
export default class CcidTransmitter {
  constructor () {
    this._device = D.test.mockDevice ? new MockDevice() : new ChromeUsbDevice()
    this._seqNum = 0

    this._plugListener = () => {}
    this._device.listenPlug((error, status) => {
      D.dispatch(() => this._plugListener(error, status))
    })
  }

  listenPlug (callback) {
    if (callback) this._plugListener = callback
  }

  // noinspection JSUnusedGlobalSymbols
  async reset () {
    await this._sendAndReceive(Buffer.from('63000000000000000000', 'hex'))
    await this._sendAndReceive(Buffer.from('62000000000000010000', 'hex'))
  }

  /**
   * APDU encrypt & decrypt
   */
  async sendApdu (apdu, isEnc = false) {
    // a simple lock to guarantee apdu order
    while (this.busy) {
      await D.wait(10)
    }
    this.busy = true

    try {
      // currently S300 APDU encryption not supported
      // must use await to make lock effective
      // noinspection UnnecessaryLocalVariableJS
      let response = await this._sendApdu(apdu)
      return response
    } finally {
      this.busy = false
    }
  }

  /**
   * APDU special response handling
   */
  async _sendApdu (apdu) {
    let {result, response} = await this._transmit(apdu)

    // 9060 means busy, send 00c0000000 immediately to get response
    while (result === 0x9060) {
      let waitCmd = Buffer.from('000c0000000', 'hex')
      let {_result, _response} = await this._transmit(waitCmd)
      result = _result
      response = _response
    }

    // 61XX means there are still XX bytes to get
    while ((result & 0xFF00) === 0x6100) {
      console.debug('got 0x61XX, get remain data')
      let rApdu = Buffer.from('00C0000000', 'hex')
      rApdu[0x04] = result & 0xFF
      let ret = await this._transmit(rApdu)
      response = Buffer.concat([response, ret.response])
      result = ret.result
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

    this._seqNum = 0
    console.debug('transmit send apdu', apdu.toString('hex'))
    let sendPack = packCcidCmd(this._seqNum++, apdu)
    let response = await this._sendAndReceive(sendPack)
    if (!response || response.length < 2) {
      console.warn('invalid response without sw1sw2')
      throw D.error.deviceProtocol
    }

    let indexSw1Sw2 = response.length - 2
    let sw1sw2 = (response[indexSw1Sw2] << 8) + response[indexSw1Sw2 + 1]
    let responseData = response.slice(0, indexSw1Sw2)
    console.debug('transmit got response', sw1sw2.toString(16), responseData.toString('hex'))
    return {result: sw1sw2, response: responseData}
  }

  async _sendAndReceive (pack) {
    const packRecvCcidCmd = (seqNum) => {
      const levelParameter = 0x0010
      let cmd = Buffer.from('62000000000000000000', 'hex')
      cmd[0x06] = seqNum
      cmd.writeUInt16LE(levelParameter, 0x08)
      return cmd
    }

    await this._device.send(pack)

    let response = Buffer.alloc(0)
    while (true) {
      let received = await this._device.receive()
      // wait for user
      while (received[0x07] === 0x80 && received[0x08] === 0x01) {
        received = await this._device.receive()
      }
      if (!received || received.length < 0x0A ||
        (received[0] !== 0x80 && pack[0] !== 0x63)) {
        console.warn('CCID receive package invalid', received && received.toString('hex'))
        throw D.error.deviceProtocol
      }

      let recvLen = received.readUInt32LE(0x01)
      response = Buffer.concat([response, received.slice(0x0A, 0x0A + recvLen)])

      let finish = received[0x09] !== 0x01 && received[0x09] !== 0x03
      if (finish) break

      let respPack = packRecvCcidCmd(this._seqNum++)
      received = await this._device.send(respPack)
    }
    return response
  }

  static _checkSw1Sw2 (sw1sw2) {
    let errorCode = D.error.checkSw1Sw2(sw1sw2)
    if (errorCode !== D.error.succeed) throw errorCode
  }
}
