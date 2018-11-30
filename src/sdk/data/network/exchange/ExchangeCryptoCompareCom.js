
import D from '../../../D'

let UPDATE_DURATION = 60 * 60 * 1000

export default class ExchangeCryptoCompareCom {
  constructor (exchange) {
    if (!exchange) {
      console.warn('ExchangeCryptoCompareCom invalid parameters', exchange)
      throw D.error.invalidParams
    }
    this.provider = 'cryptocompare.com'

    this.coinType = exchange.coinType
    this.exchange = D.copy(exchange)
    if (D.isBtc(exchange.coinType)) {
      this.exchange.unit = D.unit.btc.BTC
      this.requestCoin = 'BTC'
    } else if (D.isEth(exchange.coinType)) {
      this.exchange.unit = D.unit.eth.Ether
      this.requestCoin = 'ETH'
    } else if (D.isEos(exchange.coinType)) {
      this.exchange.unit = D.unit.eos.EOS
      this.requestCoin = 'EOS'
    } else {
      console.warn('ExchangeCryptoCompareCom don\'t support this coinType', exchange.coinType)
      throw D.error.coinNotSupported
    }
    this.exchange.exchange = exchange.exchange ||
      D.suppertedLegals().reduce((obj, currency) => (obj[currency] = 0) || obj, {})

    // noinspection JSIgnoredPromiseFromCall
    this.updateExchange()
    setInterval(() => this.updateExchange().catch(e => console.warn(e)), UPDATE_DURATION)
  }

  onUpdateExchange () {
  }

  getCurrentExchange () {
    return D.copy(this.exchange)
  }

  async updateExchange () {
    const url = 'https://min-api.cryptocompare.com/data/price?fsym=' + this.requestCoin + '&tsyms=USD,JPY,EUR,CNY'
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
                reject(D.error.networkProviderError)
              }
            } else if (xmlhttp.status === 500) {
              console.warn(url, xmlhttp.status)
              reject(D.error.networkProviderError)
            } else {
              console.warn(url, xmlhttp.status)
              reject(D.error.networkUnavailable)
            }
          }
        }
        xmlhttp.open('GET', url, true)
        xmlhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
        xmlhttp.send()
      })
    }

    /**
     * response:
     * {
     *   "USD": float,
     *   "JPY": float,
     *   "EUR": float,
     *   "CNY": float
     * }
     */
    let response = await get(url)
    let exchange = D.copy(this.exchange)
    exchange.exchange = response
    console.debug('update exchange succeed', 'old exchange', this.exchange, 'new exchange', exchange)
    this.exchange = D.copy(exchange)
    this.onUpdateExchange(exchange)
  }
}
