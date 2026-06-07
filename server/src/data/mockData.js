// Hardcoded fallback data used when all external APIs are unavailable

const mockCoins = [
  { id:'bitcoin',          name:'Bitcoin',       symbol:'BTC',   image:'https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png',        price:61000,  change_24h: 1.2,  market_cap:1200000000000 },
  { id:'ethereum',         name:'Ethereum',      symbol:'ETH',   image:'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',       price:1600,   change_24h:-0.8,  market_cap:192000000000 },
  { id:'tether',           name:'Tether',        symbol:'USDT',  image:'https://coin-images.coingecko.com/coins/images/325/large/Tether.png',         price:1.00,   change_24h: 0.01, market_cap:110000000000 },
  { id:'binancecoin',      name:'BNB',           symbol:'BNB',   image:'https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',   price:520,    change_24h: 0.5,  market_cap:76000000000 },
  { id:'solana',           name:'Solana',        symbol:'SOL',   image:'https://coin-images.coingecko.com/coins/images/4128/large/solana.png',        price:145,    change_24h: 2.3,  market_cap:68000000000 },
  { id:'ripple',           name:'XRP',           symbol:'XRP',   image:'https://coin-images.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png', price:0.52, change_24h:-1.1, market_cap:29000000000 },
  { id:'dogecoin',         name:'Dogecoin',      symbol:'DOGE',  image:'https://coin-images.coingecko.com/coins/images/5/large/dogecoin.png',          price:0.12,   change_24h: 3.1,  market_cap:17000000000 },
  { id:'cardano',          name:'Cardano',       symbol:'ADA',   image:'https://coin-images.coingecko.com/coins/images/975/large/cardano.png',         price:0.38,   change_24h:-0.5,  market_cap:13000000000 },
  { id:'avalanche-2',      name:'Avalanche',     symbol:'AVAX',  image:'https://coin-images.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png', price:26, change_24h: 1.8, market_cap:11000000000 },
  { id:'chainlink',        name:'Chainlink',     symbol:'LINK',  image:'https://coin-images.coingecko.com/coins/images/877/large/chainlink-new-logo.png', price:12,  change_24h: 0.9,  market_cap:7600000000 },
  { id:'polkadot',         name:'Polkadot',      symbol:'DOT',   image:'https://coin-images.coingecko.com/coins/images/12171/large/polkadot.png',      price:6.2,    change_24h:-1.4,  market_cap:9100000000 },
  { id:'litecoin',         name:'Litecoin',      symbol:'LTC',   image:'https://coin-images.coingecko.com/coins/images/2/large/litecoin.png',          price:78,     change_24h: 0.3,  market_cap:5800000000 },
  { id:'uniswap',          name:'Uniswap',       symbol:'UNI',   image:'https://coin-images.coingecko.com/coins/images/12504/large/uni.jpg',           price:6.8,    change_24h: 1.5,  market_cap:4100000000 },
  { id:'stellar',          name:'Stellar',       symbol:'XLM',   image:'https://coin-images.coingecko.com/coins/images/100/large/Stellar_symbol_black_RGB.png', price:0.098, change_24h:-0.7, market_cap:2900000000 },
  { id:'monero',           name:'Monero',        symbol:'XMR',   image:'https://coin-images.coingecko.com/coins/images/69/large/monero_logo.png',       price:168,    change_24h: 0.6,  market_cap:3100000000 },
  { id:'ethereum-classic', name:'Ethereum Classic', symbol:'ETC', image:'https://coin-images.coingecko.com/coins/images/453/large/ethereum-classic-logo.png', price:22, change_24h:-0.4, market_cap:3200000000 },
  { id:'filecoin',         name:'Filecoin',      symbol:'FIL',   image:'https://coin-images.coingecko.com/coins/images/12817/large/filecoin.png',      price:3.8,    change_24h:-1.2,  market_cap:2100000000 },
  { id:'vechain',          name:'VeChain',       symbol:'VET',   image:'https://coin-images.coingecko.com/coins/images/1167/large/VET_Token_Icon.png', price:0.022,  change_24h: 0.8,  market_cap:1900000000 },
  { id:'theta-token',      name:'Theta Network', symbol:'THETA', image:'https://coin-images.coingecko.com/coins/images/2538/large/theta-token-logo.png', price:1.2,  change_24h: 1.1,  market_cap:1200000000 },
  { id:'tron',             name:'TRON',          symbol:'TRX',   image:'https://coin-images.coingecko.com/coins/images/1094/large/tron-logo.png',      price:0.11,   change_24h:-0.3,  market_cap:9700000000 },
];

const mockNews = [
  { id:'mn1', title:'Bitcoin consolidates above $60K as institutional demand holds steady', url:'https://www.coindesk.com/markets/2024/01/bitcoin-consolidates-60k/', source:'CoinDesk', published_at: new Date().toISOString() },
  { id:'mn2', title:'Ethereum Layer 2 transaction volumes reach new all-time highs this quarter', url:'https://cointelegraph.com/news/ethereum-layer-2-volumes-ath', source:'CoinTelegraph', published_at: new Date().toISOString() },
  { id:'mn3', title:'On-chain data shows record number of long-term Bitcoin holders accumulating', url:'https://decrypt.co/news/bitcoin-long-term-holders-accumulating', source:'Decrypt', published_at: new Date().toISOString() },
  { id:'mn4', title:'Solana DeFi TVL surpasses $5 billion milestone for the first time', url:'https://www.theblock.co/post/solana-defi-tvl-5-billion', source:'The Block', published_at: new Date().toISOString() },
  { id:'mn5', title:'Regulatory clarity drives renewed interest from global asset managers', url:'https://blockworks.co/news/regulatory-clarity-asset-managers', source:'Blockworks', published_at: new Date().toISOString() },
  { id:'mn6', title:'Bitcoin ETF net inflows hit record weekly high as institutional adoption accelerates', url:'https://www.coindesk.com/markets/2024/01/bitcoin-etf-record-inflows/', source:'CoinDesk', published_at: new Date().toISOString() },
  { id:'mn7', title:'DeFi protocol revenues outpace traditional fintech for third consecutive quarter', url:'https://thedefiant.io/defi-revenues-outpace-fintech', source:'The Defiant', published_at: new Date().toISOString() },
  { id:'mn8', title:'Crypto market correlations with equities decline as the asset class matures', url:'https://blockworks.co/news/crypto-market-correlation-equities-decline', source:'Blockworks', published_at: new Date().toISOString() },
];

const mockInsight = {
  text: 'Bitcoin continues to show resilience above key support levels while institutional accumulation trends remain bullish. Layer 2 adoption on Ethereum is driving fee compression and expanding DeFi use cases. For long-term holders, volatility presents DCA opportunities rather than reasons to exit positions.',
  model: 'static',
  generated_at: new Date().toISOString(),
};

const mockMemes = [
  { id:'1',  title:'Portfolio -40%. This is fine.',                         imageUrl:'https://imgflip.com/s/meme/This-Is-Fine.jpg' },
  { id:'2',  title:'Me buying every dip. It keeps dipping.',               imageUrl:'https://imgflip.com/s/meme/Stonks.jpg' },
  { id:'3',  title:'Much HODL. Very diamond hands.',                        imageUrl:'https://imgflip.com/s/meme/Doge.jpg' },
  { id:'4',  title:'Selling at a loss vs HODLing to zero.',                 imageUrl:'https://imgflip.com/s/meme/Drake-Hotline-Bling.jpg' },
  { id:'5',  title:"Can't lose money if you never check the price.",        imageUrl:'https://imgflip.com/s/meme/Roll-Safe-Think-About-It.jpg' },
  { id:'6',  title:'Altcoin rugs without warning. Surprised investors.',    imageUrl:'https://imgflip.com/s/meme/Surprised-Pikachu.jpg' },
  { id:'7',  title:'Me ignoring Bitcoin for a new shiny altcoin.',          imageUrl:'https://imgflip.com/s/meme/Distracted-Boyfriend.jpg' },
  { id:'8',  title:'DCA into BTC weekly. Change my mind.',                  imageUrl:'https://imgflip.com/s/meme/Change-My-Mind.jpg' },
  { id:'9',  title:'Not sure if bull run — or just a dead cat bounce.',     imageUrl:'https://imgflip.com/s/meme/Futurama-Fry.jpg' },
  { id:'10', title:'Brace yourselves. Crypto Twitter takes incoming.',      imageUrl:'https://imgflip.com/s/meme/Brace-Yourselves-X-is-Coming.jpg' },
  { id:'11', title:"Oh, you're a long-term investor? Name every coin.",     imageUrl:'https://imgflip.com/s/meme/Condescending-Wonka.jpg' },
  { id:'12', title:'You get rekt! Everybody gets rekt!',                    imageUrl:'https://imgflip.com/s/meme/Oprah-You-Get-A.jpg' },
  { id:'13', title:'My crypto gains are taxable events. A tragedy.',        imageUrl:'https://imgflip.com/s/meme/First-World-Problems.jpg' },
  { id:'14', title:'Two buttons: check portfolio / sleep peacefully.',      imageUrl:'https://imgflip.com/s/meme/Two-Buttons.jpg' },
  { id:'15', title:'Wen Lambo? Wen Lambo everywhere.',                      imageUrl:'https://imgflip.com/s/meme/Buzz-Lightyear-Everywhere.jpg' },
];

const mockInsightTemplates = [
  {
    investor_type: 'hodler',
    insight: 'Bitcoin continues to accumulate institutional demand at current levels, making dollar-cost averaging a sound strategy for long-term holders. On-chain metrics show a declining exchange supply, historically a precursor to reduced sell pressure. Stay the course — conviction and patience remain the most underrated edges in crypto.',
  },
  {
    investor_type: 'day trader',
    insight: 'Intraday volatility in BTC and ETH is presenting tight range-bound setups ideal for scalping key support and resistance levels. Watch the 4-hour RSI for divergence signals before entering momentum trades. Risk management matters most today — size down on breakout plays until volume confirms direction.',
  },
  {
    investor_type: 'nft collector',
    insight: 'Ethereum gas fees have dropped significantly this week, making it a cost-effective time to mint or transfer NFTs on mainnet. Blue-chip collections are seeing renewed floor activity while emerging artists on Solana and Base are gaining collector attention. Consider diversifying across chains where royalty enforcement remains strongest.',
  },
  {
    investor_type: 'defi farmer',
    insight: 'Liquidity incentives on Ethereum Layer 2s are compressing yields as TVL grows, making it worth rotating into newer protocols with sustainable emission schedules. Solana DeFi is generating meaningful real yield on leveraged staking strategies this week. Always verify smart contract audits before deploying capital into newly launched vaults.',
  },
  {
    investor_type: 'swing trader',
    insight: 'The weekly structure on BTC shows a potential higher-low forming after last week\'s pullback, offering a defined risk entry for swing longs targeting the previous high. Altcoin seasonality signals are mixed — focus on coins with strong relative strength against BTC rather than chasing weak performers. Set alerts at key weekly closes rather than reacting to hourly noise.',
  },
  {
    investor_type: 'technical analyst',
    insight: 'Bitcoin is compressing within a symmetrical triangle on the daily chart, with a measured move target roughly 12% above the current breakout zone if confirmed on volume. The 200-day moving average is flattening, suggesting a potential trend transition rather than a continuation. Watch for a decisive close above last week\'s high to invalidate the bearish scenario.',
  },
  {
    investor_type: 'diversified',
    insight: 'A balanced crypto portfolio across large caps, mid caps, and stablecoins is well-positioned for current market conditions given mixed macro signals. Rebalancing quarterly reduces the emotional impact of volatility while capturing relative strength shifts between sectors. Consider trimming positions that have grown to outsized weightings and rotating into underperforming blue chips.',
  },
  {
    investor_type: 'curious beginner',
    insight: 'The best first step in crypto is understanding what you own — Bitcoin is digital scarcity, Ethereum is programmable money, and everything else builds on those ideas. Start with small amounts you can afford to lose entirely while you learn how wallets, exchanges, and volatility actually feel in practice. Reading one credible article per day compounds faster than trying to catch every price move.',
  },
  {
    investor_type: 'yield seeker',
    insight: 'Stablecoin yields in DeFi protocols are currently ranging between 5–12% APY across reputable platforms, offering a meaningful alternative to traditional fixed income. Collateralized lending protocols on Ethereum maintain strong liquidation buffers, reducing counterparty risk for conservative yield seekers. Ladder maturities across 2–3 platforms to avoid concentration risk in any single smart contract.',
  },
  {
    investor_type: 'momentum trader',
    insight: 'Several mid-cap altcoins are printing higher highs and higher lows on the weekly chart with expanding volume — a classic momentum setup worth tracking. The altcoin-to-Bitcoin ratio is showing early signs of rotation, which historically precedes a broader alt season by 2–4 weeks. Trail stops aggressively on open positions to protect gains if the macro environment shifts.',
  },
];

function mockChartData(basePrice, days) {
  const count = days === 30 ? 60 : 42;
  const intervalMs = (days * 24 * 60 * 60 * 1000) / count;
  const now = Date.now();
  let price = basePrice;
  return Array.from({ length: count + 1 }, (_, i) => {
    price *= (1 + (Math.random() - 0.5) * 0.05);
    price = Math.max(basePrice * 0.85, Math.min(basePrice * 1.15, price));
    return { ts: Math.round(now - (count - i) * intervalMs), price: Math.round(price * 100) / 100 };
  });
}

module.exports = { mockCoins, mockNews, mockInsight, mockInsightTemplates, mockMemes, mockChartData };
