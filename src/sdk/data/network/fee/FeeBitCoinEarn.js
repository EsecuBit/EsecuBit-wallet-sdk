
import D from '../../../D'

let UPDATE_DURATION = 30 * 60 * 1000
if (D.TEST_NETWORK_REQUEST) {
  UPDATE_DURATION = 60 * 1000
}

export default class FeeBitCoinEarn {
  constructor (fee = {}) {
    this.fee = {} // santonshi per b
    this.fee[D.FEE_FAST] = fee[D.FEE_FAST] || 100
    this.fee[D.FEE_NORMAL] = fee[D.FEE_NORMAL] || 50
    this.fee[D.FEE_ECNOMIC] = fee[D.FEE_ECNOMIC] || 20

    // noinspection JSIgnoredPromiseFromCall
    this.updateFee()
    setInterval(() => {
      this.updateFee().catch(e => console.warn(e))
    }, UPDATE_DURATION)
  }

  onUpdateFee () {
  }

  getCurrentFee () {
    return Object.assign(this.fee)
  }

  async updateFee () {
    const url = 'https://bitcoinfees.earn.com/api/v1/fees/recommended'
    let get = (url) => {
      return new Promise((resolve, reject) => {
        console.debug('get', url)
        let xmlhttp = new XMLHttpRequest()
        xmlhttp.onreadystatechange = () => {
          if (xmlhttp.readyState === 4) {
            if (xmlhttp.status === 200) {
              try {
                resolve(JSON.parse(xmlhttp.responseText))
              } catch (e) {
                console.warn(e)
                reject(D.ERROR_NETWORK_PROVIDER_ERROR)
              }
            } else if (xmlhttp.status === 500) {
              console.warn(url, xmlhttp.status)
              reject(D.ERROR_NETWORK_PROVIDER_ERROR)
            } else {
              console.warn(url, xmlhttp.status)
              reject(D.ERROR_NETWORK_UNVAILABLE)
            }
          }
        }
        xmlhttp.open('GET', url, true)
        xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
        xmlhttp.send()
      })
    }

    /**
     * response
     *
     * @param response.fastestFee   Suggested fee(santonshi per b) to confirmed in 1 block.
     * @param response.halfHourFee  Suggested fee(santonshi per b) to confirmed in 3 blocks.
     * @param response.hourFee    Suggested fee(santonshi per b) to confirmed in 6 blocks.
     */
    let response = await get(url)
    let fee = {}
    fee[D.FEE_FAST] = response.fastestFee
    fee[D.FEE_NORMAL] = response.halfHourFee
    fee[D.FEE_ECNOMIC] = response.hourFee
    console.debug('update fee succeed', 'old fee', this.fee, 'new fee', fee)
    this.fee = D.copy(fee)
    this.onUpdateFee(fee)
    return fee
  }
}
