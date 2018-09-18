
import D from '../../../sdk/D'
import chai from 'chai'
import FatApi from '../../../sdk/device/fat/FatApi'
import MockTransmitter from '../../../sdk/device/transmit/MockTransmitter'
import FatCache from '../../../sdk/device/fat/FatCache'

chai.should()
describe('FatCache', function () {
  this.timeout(60 * 1000)

  // caution! if you use real device to runing these tests, the fat system will destroied!
  const fatCache = new FatCache(new FatApi(new MockTransmitter()))
  const mockFileSize = MockTransmitter.fileSize

  it('init', async function () {
    await fatCache.init()
  })

  it('readBlocks', async function () {

  })
})
