
import D from '../../../D'

export default class BitCoinFeeEarn {
  constructor (fee = {}) {
    this.fee = {} // santonshi per b
    this.fee[D.FEE_FAST] = fee[D.FEE_FAST] || 100
    this.fee[D.FEE_NORMAL] = fee[D.FEE_NORMAL] || 50
    this.fee[D.FEE_ECNOMIC] = fee[D.FEE_ECNOMIC] || 20
  }

  async updateFee () {
    const url = 'https://bitcoinfees.earn.com/api/v1/fees/recommended'
    let get = (url) => {
      return new Promise((resolve, reject) => {
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
    console.info('update fee succeed', 'old fee', this.fee)
    this.fee[D.FEE_FAST] = response.fastestFee
    this.fee[D.FEE_NORMAL] = response.halfHourFee
    this.fee[D.FEE_ECNOMIC] = response.hourFee
    console.info('new fee', this.fee)
    return Object.assign(this.fee)
  }
}
