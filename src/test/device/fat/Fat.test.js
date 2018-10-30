import chai from 'chai'
import FatApi from '../../../sdk/device/implements/fat/FatApi'
import MockTransmitter from '../../../sdk/device/implements/transmit/MockTransmitter'
import Fat from '../../../sdk/device/implements/fat/Fat'

chai.should()

function random (low, high) {
  return Math.floor(Math.random() * (high - low) + low)
}

function randomData (length) {
  let data = Buffer.allocUnsafe(length)
  for (let i = 0; i < data.length; i++) {
    data[i] = random(0, 256)
  }
  return data
}

function randomString (length) {
  const str = 'qwertyuiopasdfghjklzxcvbnm'
  let s = ''
  for (let i = 0; i < length; i++) {
    s += str[random(0, str.length)]
  }
  return s
}

describe('Fat', function () {
  this.timeout(10 * 60 * 1000)

  const fat = new Fat(new FatApi(new MockTransmitter()))

  before(async function () {
    await fat.init()
  })

  it('createFile & deleteFile', async function () {
    const operate = async function (isPublic) {
      let count = 100
      for (let i = 0; i < count; i++) {
        let fileName = randomData(0, Fat.maxFileNameLength / 2).toString('hex')
        let maxLen = fat._fatCache.pubBlockNum * fat._fatCache.blockSize - Fat.fileAttrSize - fileName.length
        let fileLen = random(0, maxLen)
        await fat.createFile(fileName, fileLen, isPublic)
        await fat.deleteFile(fileName, isPublic)
      }
    }

    await operate(true)
    await operate(false)
  })

  it('writeFile & readFile', async function () {
    const operate = async function (isPublic) {
      let count = 1000
      let file1 = '1' + randomString(random(1, Fat.maxFileNameLength - 1))
      let file2 = '2' + randomString(random(1, Fat.maxFileNameLength - 1))
      let file3 = '3' + randomString(random(1, Fat.maxFileNameLength - 1))

      let blockNum = isPublic ? fat._fatCache.pubBlockNum : fat._fatCache.priBlockNum
      let maxBlock = Math.floor(blockNum / 3)
      maxBlock -= maxBlock % 2 // fat will occupied more space for less fragment
      let maxLen = maxBlock * fat._fatCache.blockSize - Fat.fileAttrSize - Fat.maxFileNameLength

      for (let i = 0; i < count; i++) {
        let dataEndIndex1 = random(0, maxLen / count * (Math.min(i + count / 10, count)))
        // let dataEndIndex1 = maxLen
        let offset1 = random(0, dataEndIndex1)
        let data1 = randomData(dataEndIndex1 - offset1)
        await fat.writeFile(file1, data1, offset1, isPublic)

        let dataEndIndex2 = random(0, maxLen / count * (Math.min(i + count / 10, count)))
        // let dataEndIndex2 = maxLen
        let offset2 = random(0, dataEndIndex2)
        let data2 = randomData(dataEndIndex2 - offset2)
        await fat.writeFile(file2, data2, offset2, isPublic)

        let dataEndIndex3 = random(0, maxLen / count * (Math.min(i + count / 10, count)))
        // let dataEndIndex3 = maxLen
        let offset3 = random(0, dataEndIndex3)
        let data3 = randomData(dataEndIndex3 - offset3)
        await fat.writeFile(file3, data3, offset3, isPublic)

        let data1r = await fat.readFile(file1, offset1, data1.length, isPublic)
        data1.length.should.equal(data1r.length)
        for (let i = 0; i < data1.length; i++) {
          data1[i].should.equal(data1r[i])
        }

        let data2r = await fat.readFile(file2, offset2, data2.length, isPublic)
        data2.length.should.equal(data2r.length)
        for (let i = 0; i < data2.length; i++) {
          data2[i].should.equal(data2r[i])
        }

        let data3r = await fat.readFile(file3, offset3, data3.length, isPublic)
        data3.length.should.equal(data3r.length)
        for (let i = 0; i < data3.length; i++) {
          data3[i].should.equal(data3r[i])
        }
      }
    }

    await operate(true)
    await operate(false)
  })
})
