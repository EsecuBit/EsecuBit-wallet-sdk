
import D from '../../../D'

let UPDATE_DURATION = 30 * 60 * 1000
if (D.TEST_NETWORK_REQUEST) {
  UPDATE_DURATION = 60 * 1000
}

const UNITS = {}
UNITS[D.COIN_BIT_COIN] = D.UNIT_BTC
UNITS[D.COIN_BIT_COIN_TEST] = D.UNIT_BTC
UNITS[D.COIN_ETH] = D.UNIT_ETH
UNITS[D.COIN_ETH_TEST_RINKEBY] = D.UNIT_ETH

const REQUEST_COINS = {}
REQUEST_COINS[D.COIN_BIT_COIN] = 'BTC'
REQUEST_COINS[D.COIN_BIT_COIN_TEST] = 'BTC'
REQUEST_COINS[D.COIN_ETH] = 'ETH'
REQUEST_COINS[D.COIN_ETH_TEST_RINKEBY] = 'ETH'

export default class ExchangeCryptoCompareCom {
  constructor (exchange) {
    switch (exchange.coinType) {
      case D.COIN_BIT_COIN:
      case D.COIN_BIT_COIN_TEST:
      case D.COIN_ETH:
      case D.COIN_ETH_TEST_RINKEBY:
        this.coinType = exchange.coinType
        break
      default:
        throw D.ERROR_COIN_NOT_SUPPORTED
    }

    this.exchange = D.copy(exchange)
    this.exchange.unit = UNITS[exchange.coinType]
    this.exchange.exchange = exchange.exchange ||
      D.SUPPORTED_LEGAL_CURRENCY.reduce((obj, currency) => (obj[currency] = 0) || obj, {})
    this.requestCoin = REQUEST_COINS[exchange.coinType]

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
     *{
     * "USD": float,
     * "JPY": float,
     * "EUR": float,
     * "CNY": float,
     *}
     */
    let response = await get(url)
    let exchange = D.copy(this.exchange)
    exchange.exchange = response
    console.debug('update exchange succeed', 'old exchange', this.exchange, 'new exchange', exchange)
    this.exchange = D.copy(exchange)
    this.onUpdateExchange(exchange)
  }
}
