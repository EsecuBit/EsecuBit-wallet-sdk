
import D from '../../../sdk/D'
import chai from 'chai'
import FatApi from '../../../sdk/device/implements/fat/FatApi'
import MockTransmitter from '../../../sdk/device/implements/transmit/MockTransmitter'

chai.should()
describe('FatApi', function () {
  this.timeout(60 * 1000)

  // caution! if you use real device to runing these tests, the fat system will be destroied!
  const fatApi = new FatApi(new MockTransmitter())
  const mockFileSize = MockTransmitter.fileSize

  it('selectFile', async function () {
    await fatApi.selectFile(0x1EA8)
    await fatApi.selectFile(0x1000)

    let error = D.error.succeed
    await fatApi.selectFile(0).catch(e => { error = e })
    error.should.equal(D.error.deviceProtocol)
    error = D.error.succeed
    await fatApi.selectFile(0x1EA7).catch(e => { error = e })
    error.should.equal(D.error.deviceProtocol)
    error = D.error.succeed
    await fatApi.selectFile(0x1001).catch(e => { error = e })
    error.should.equal(D.error.deviceProtocol)
  })

  it('readFile', async function () {
    await fatApi.selectFile(0x1EA8)
    await fatApi.readFile(0, 1000)
    await fatApi.readFile(0, 2000)
    await fatApi.readFile(0, 4000)
    await fatApi.readFile(0, 8000)
    await fatApi.readFile(0, 10 * 1024)
    await fatApi.readFile(2000, 6000)
    await fatApi.readFile(5000, 5000)

    let error = D.error.succeed
    await fatApi.readFile(1, mockFileSize).catch(e => { error = e })
    error.should.equal(D.error.deviceProtocol)

    await fatApi.selectFile(0x1000)
    await fatApi.readFile(0, 1000)
    await fatApi.readFile(0, 2000)
    await fatApi.readFile(0, 4000)
    await fatApi.readFile(0, 8000)
    await fatApi.readFile(0, 10 * 1024)
    await fatApi.readFile(2000, 6000)
    await fatApi.readFile(5000, 5000)

    error = D.error.succeed
    await fatApi.readFile(1, mockFileSize).catch(e => { error = e })
    error.should.equal(D.error.deviceProtocol)
  })

  it('writeFile', async function () {
    let data = Buffer.alloc(mockFileSize)

    await fatApi.selectFile(0x1EA8)
    await fatApi.writeFile(0, data.slice(0, 1000))
    await fatApi.writeFile(0, data.slice(0, 2000))
    await fatApi.writeFile(0, data.slice(0, 4000))
    await fatApi.writeFile(0, data.slice(0, 8000))
    await fatApi.writeFile(0, data)
    await fatApi.writeFile(2000, data.slice(2000, 6000))
    await fatApi.writeFile(5000, data.slice(5000, 5000))

    let error = D.error.succeed
    await fatApi.writeFile(1, data).catch(e => { error = e })
    error.should.equal(D.error.deviceProtocol)

    await fatApi.selectFile(0x1000)
    await fatApi.writeFile(0, data.slice(0, 1000))
    await fatApi.writeFile(0, data.slice(0, 2000))
    await fatApi.writeFile(0, data.slice(0, 4000))
    await fatApi.writeFile(0, data.slice(0, 8000))
    await fatApi.writeFile(0, data)
    await fatApi.writeFile(2000, data.slice(2000, 6000))
    await fatApi.writeFile(5000, data.slice(5000, 5000))

    error = D.error.succeed
    await fatApi.writeFile(1, data).catch(e => { error = e })
    error.should.equal(D.error.deviceProtocol)
  })

  it('randomReadWrite', async function () {
    const random = (low, high) => {
      return Math.floor(Math.random() * (high - low) + low)
    }

    let data = Buffer.allocUnsafe(mockFileSize)
    for (let i = 0; i < data.length; i++) {
      data[i] = random(0, 256)
    }

    await fatApi.selectFile(0x1EA8)
    let count = 100
    while (count--) {
      let offset = random(0, mockFileSize)
      let size = random(0, mockFileSize - offset)
      let subData = data.slice(offset, offset + size)
      await fatApi.writeFile(offset, subData)
      let readSubData = await fatApi.readFile(offset, size)

      for (let i = 0; i < size; i++) {
        subData[i].should.equal(readSubData[i])
      }
    }

    await fatApi.selectFile(0x1000)
    count = 100
    while (count--) {
      let offset = random(0, mockFileSize)
      let size = random(0, mockFileSize - offset)
      let subData = data.slice(offset, offset + size)
      await fatApi.writeFile(offset, subData)
      let readSubData = await fatApi.readFile(offset, size)

      for (let i = 0; i < size; i++) {
        subData[i].should.equal(readSubData[i])
      }
    }
  })
})
