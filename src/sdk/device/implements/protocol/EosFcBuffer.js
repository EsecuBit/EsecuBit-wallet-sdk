import ByteBuffer from 'bytebuffer'
import {Buffer} from 'buffer'
import D from '../../../D'

const FcBuffer = {
  serializeTx (tx) {
    let buffer = new ByteBuffer(100, true, true)

    try {
      FcBuffer.uint32.appendByteBuffer(buffer, tx.expiration)
      FcBuffer.uint16.appendByteBuffer(buffer, tx.ref_block_num)
      FcBuffer.uint32.appendByteBuffer(buffer, tx.ref_block_prefix)
      FcBuffer.varuint32.appendByteBuffer(buffer, tx.max_net_usage_words)
      FcBuffer.uint8.appendByteBuffer(buffer, tx.max_cpu_usage_ms)
      FcBuffer.varuint32.appendByteBuffer(buffer, tx.delay_sec)
      FcBuffer.actions.appendByteBuffer(buffer, tx.context_free_actions)
      FcBuffer.actions.appendByteBuffer(buffer, tx.actions)
      FcBuffer.transactionExtensions.appendByteBuffer(buffer, tx.transaction_extensions)

      buffer = buffer.copy(0, buffer.offset)
      return Buffer.from(buffer.buffer)
    } catch (e) {
      console.warn(e)
      console.warn('serializeTx failed', tx)
      throw D.error.invalidParams
    }
  },

  uint8: {
    appendByteBuffer (b, value) {
      b.writeUint8(value)
    }
  },

  uint16: {
    appendByteBuffer (b, value) {
      b.writeUint16(value)
    }
  },

  uint32: {
    appendByteBuffer (b, value) {
      b.writeUint32(value)
    }
  },

  uint64: {
    appendByteBuffer (b, value) {
      b.writeUint64(value)
    },

    toBuffer (value) {
      let buffer = new ByteBuffer(8, true, true)
      this.appendByteBuffer(buffer, value)
      buffer = buffer.copy(0, buffer.offset)
      return Buffer.from(buffer.buffer)
    }
  },

  varuint32: {
    appendByteBuffer (b, value) {
      b.writeVarint32(value)
    }
  },

  string: {
    appendByteBuffer (b, value) {
      b.writeVString(value)
    }
  },

  name: {
    appendByteBuffer (b, value) {
      b.writeUint64(this.encodeName(value, false))
    },

    toBuffer (value) {
      let buffer = new ByteBuffer(8, true, true)
      this.appendByteBuffer(buffer, value)
      buffer = buffer.copy(0, buffer.offset)
      return Buffer.from(buffer.buffer)
    },

    /**
     * Copy from eos.js.
     *
     * Encode a name (a base32 string) to a number.
     *
     * For performance reasons, the blockchain uses the numerical encoding of strings
     * for very common types like account names.
     *
     * @see types.hpp string_to_name
     *
     * @arg {string} name - A string to encode, up to 12 characters long.
     * @arg {string} [littleEndian = true] - Little or Bigendian encoding
     *
     * @return {string<uint64>} - compressed string (from name arg).  A string is
     * always used because a number could exceed JavaScript's 52 bit limit.
     */
    encodeName (name) {
      const Long = ByteBuffer.Long
      const charmap = '.12345abcdefghijklmnopqrstuvwxyz'
      const charidx = function charidx (ch) {
        const idx = charmap.indexOf(ch)
        if (idx === -1) throw new TypeError('Invalid character: \'' + ch + '\'')
        return idx
      }

      let littleEndian = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true

      if (typeof name !== 'string') throw new TypeError('name parameter is a required string')

      if (name.length > 12) throw new TypeError('A name can be up to 12 characters long')

      let bitstr = ''
      for (let i = 0; i <= 12; i++) {
        // process all 64 bits (even if name is short)
        let c = i < name.length ? charidx(name[i]) : 0
        let bitlen = i < 12 ? 5 : 4
        let bits = Number(c).toString(2)
        if (bits.length > bitlen) {
          throw new TypeError('Invalid name ' + name)
        }
        bits = '0'.repeat(bitlen - bits.length) + bits
        bitstr += bits
      }

      let value = Long.fromString(bitstr, true, 2)

      // convert to LITTLE_ENDIAN
      let leHex = ''
      let bytes = littleEndian ? value.toBytesLE() : value.toBytesBE()
      let _iteratorNormalCompletion = true
      let _didIteratorError = false
      let _iteratorError

      let _iterator = bytes[Symbol.iterator]()
      let _step
      try {
        for (; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          let b = _step.value
          let n = Number(b).toString(16)
          leHex += (n.length === 1 ? '0' : '') + n
        }
      } catch (err) {
        _didIteratorError = true
        _iteratorError = err
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return()
          }
        } catch (e) {
          console.warn(e)
        }
      }
      if (_didIteratorError) {
        throw _iteratorError
      }

      let ulName = Long.fromString(leHex, true, 16).toString()
      // console.log('encodeName', name, value.toString(), ulName.toString(), JSON.stringify(bitstr.split(/(.....)/).slice(1)))
      return ulName.toString()
    },

    /**
     * @arg {Buffer}  bytes
     *
     * @return {string}
     */
    decodeName (bytes) {
      const Long = ByteBuffer.Long
      const charmap = '.12345abcdefghijklmnopqrstuvwxyz'

      // convert from LITTLE_ENDIAN
      bytes = Buffer.from(bytes.toString('hex').match(/.{2}/g).reverse().join(''), 'hex')
      let beHex = ''
      let _iteratorNormalCompletion2 = true
      let _didIteratorError2 = false
      let _iteratorError2

      let _iterator2 = bytes[Symbol.iterator]()
      try {
        for (let _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          let b = _step2.value

          let n = Number(b).toString(16)
          beHex += (n.length === 1 ? '0' : '') + n
        }
      } catch (err) {
        _didIteratorError2 = true
        _iteratorError2 = err
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return()
          }
        } finally {
          if (_didIteratorError2) {
            // eslint-disable-next-line no-unsafe-finally
            throw _iteratorError2
          }
        }
      }

      beHex += '0'.repeat(16 - beHex.length)

      let fiveBits = Long.fromNumber(0x1f, true)
      let fourBits = Long.fromNumber(0x0f, true)
      let beValue = Long.fromString(beHex, true, 16)

      let str = ''
      let tmp = beValue

      for (let i = 0; i <= 12; i++) {
        let c = charmap[tmp.and(i === 0 ? fourBits : fiveBits)]
        str = c + str
        tmp = tmp.shiftRight(i === 0 ? 4 : 5)
      }
      str = str.replace(/\.+$/, '') // remove trailing dots (all of them)

      // console.log('decodeName', str, beValue.toString(), value.toString(), JSON.stringify(beValue.toString(2).split(/(.....)/).slice(1)))

      return str
    }
  },

  actions: {
    appendByteBuffer (b, value) {
      b.writeVarint32(value.length)
      for (let item of value) {
        if (!item.account || !item.name || !item.authorization || !item.data) {
          console.warn('invalid actions item params', b, item)
          throw D.error.invalidParams
        }
        FcBuffer.name.appendByteBuffer(b, item.account)
        FcBuffer.name.appendByteBuffer(b, item.name)
        FcBuffer.authorization.appendByteBuffer(b, item.authorization)
        FcBuffer.data.appendByteBuffer(b, item.data, item.account, item.name)
      }
    }
  },

  authorization: {
    appendByteBuffer (b, value) {
      b.writeVarint32(value.length)
      for (let item of value) {
        if (!item.actor || !item.permission) {
          console.warn('invalid authorization item params', b, item)
          throw D.error.invalidParams
        }
        FcBuffer.name.appendByteBuffer(b, item.actor)
        FcBuffer.name.appendByteBuffer(b, item.permission)
      }
    }
  },

  data: {
    appendByteBuffer (b, value, account, name) {
      let actionType = D.coin.params.eos.getActionType(account, name)
      if (!actionType) {
        console.warn('unsupport data type', b, value, account, name)
        throw D.error.invalidParams
      }

      let content = new ByteBuffer(20, true, true)
      Object.entries(actionType.data).forEach(([key, itemType]) => {
        console.info('parse data type', value, key, itemType)
        let item = value[key]
        if (item === undefined) {
          console.warn('item not found in action type', b, value, key, itemType)
          throw D.error.invalidParams
        }

        if (itemType.endsWith('[]')) {
          // handle vector
          if (!Array.isArray(item)) {
            console.warn('item not an array when itemType is vector', b, value, key, itemType)
            throw D.error.invalidParams
          }
          let subItemType = itemType.slice(0, itemType.length - 2)

          content.writeVarint32(item.length)
          item.forEach(i => {
            FcBuffer[subItemType].appendByteBuffer(content, i)
          })
        } else {
          FcBuffer[itemType].appendByteBuffer(content, item)
        }
      })

      b.writeVarint32(content.offset)
      content = content.copy(0, content.offset)
      // noinspection JSUnresolvedFunction
      content.copyTo(b)
    }
  },

  authority: {
    appendByteBuffer (b, authorityTypes) {
      console.info('parse authority type', authorityTypes)
      Object.entries(authorityTypes).forEach(([key, value]) => {
        let itemType = D.coin.params.eos.getAuthorityType(key)
        let item = value
        if (itemType === undefined) {
          console.warn('item not found in action type', b, value, key, itemType)
          throw D.error.invalidParams
        }
        if (itemType.endsWith('[]')) {
          // handle vector
          if (!Array.isArray(item)) {
            console.warn('item not an array when itemType is vector', b, value, key, itemType)
            throw D.error.invalidParams
          }
          let subItemType = itemType.slice(0, itemType.length - 2)

          b.writeVarint32(item.length)
          item.map(i => {
            FcBuffer[subItemType].appendByteBuffer(b, i)
          })
        } else {
          FcBuffer[itemType].appendByteBuffer(b, item)
        }
      })
    }
  },

  keyWeight: {
    appendByteBuffer (b, keyWeight) {
      console.info('parse keyWeight type', keyWeight)
      FcBuffer.publicKey.appendByteBuffer(b, keyWeight.key)
      FcBuffer.uint16.appendByteBuffer(b, keyWeight.weight)
    }
  },

  permissionLevelWeight: {
    appendByteBuffer (b, permissionLevelWeight) {
      console.info('parse permissionLevelWeight type', permissionLevelWeight)
      FcBuffer.permissionLevel.appendByteBuffer(b, permissionLevelWeight.permission)
      FcBuffer.uint16.appendByteBuffer(b, permissionLevelWeight.weight)
    }
  },

  permissionLevel: {
    appendByteBuffer (b, permissionLevel) {
      console.info('parse permission level type', permissionLevel)
      FcBuffer.name.appendByteBuffer(b, permissionLevel.actor)
      FcBuffer.name.appendByteBuffer(b, permissionLevel.permission)
    }
  },

  publicKey: {
    appendByteBuffer (b, publicKey) {
      console.info('parse publicKey type', publicKey)
      publicKey = D.address.stringToEosPublicKey(publicKey)
      FcBuffer.uint8.appendByteBuffer(b, publicKey.type)
      FcBuffer.uint8.appendByteBuffer(b, publicKey.data)
    }
  },

  waitWeight: {
    appendByteBuffer (b, waitWeight) {
      console.info('parse waitWeight type', waitWeight)
      FcBuffer.uint32.appendByteBuffer(b, waitWeight.wait_sec)
      FcBuffer.uint16.appendByteBuffer(b, waitWeight.weight)
    }
  },

  asset: {
    appendByteBuffer (b, str) {
      // copy from eos.js v16.0.9, ignore contract part(useless yet)
      let [amountRaw] = str.split(' ')
      let amountMatch = amountRaw.match(/^(-?[0-9]+(\.[0-9]+)?)( |$)/)
      let amount = amountMatch ? amountMatch[1] : null

      let precisionMatch = str.match(/(^| )([0-9]+),([A-Z]+)(@|$)/)
      let precisionSymbol = precisionMatch ? Number(precisionMatch[2]) : null
      let precisionAmount = amount ? (amount.split('.')[1] || '').length : null
      let precision = precisionSymbol != null ? precisionSymbol : precisionAmount

      let symbolMatch = str.match(/(^| |,)([A-Z]+)(@|$)/)
      let symbol = symbolMatch ? symbolMatch[2] : null

      if (precision === null || symbol === null || amount === null) {
        console.warn('parse asset failed', str, precision, symbol, amount)
        throw D.error.invalidParams
      }

      if (precision < 0 || precision > 18) {
        console.warn('Precision should be 18 characters or less', symbol, precision)
        throw D.error.invalidParams
      }
      if (symbol.length > 7) {
        console.warn('Invalid symbol, Symbol should be ASCII or 7 characters or less', symbol)
        throw D.error.invalidParams
      }

      b.writeUint64(amount.replace('.', ''))
      b.writeUint8(precision)
      b.writeUTF8String(symbol)

      let appendLen = 7 - symbol.length
      while (appendLen--) {
        b.writeByte(0)
      }
    }
  },

  transactionExtensions: {
    appendByteBuffer (b, value) {
      // eos don't support transactionExtensions yet
      if (value && value.length > 0) {
        console.warn('currently not support transactionExtensions')
        throw D.error.invalidParams
      }
      // vector
      b.writeByte(0)
    }
  }
}

export default FcBuffer
