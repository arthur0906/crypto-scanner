document.addEventListener('DOMContentLoaded', () => {
    const dashboard = document.getElementById('dashboard');
    const addCardBtn = document.getElementById('add-card-btn');
    const template = document.getElementById('card-template');

    // --- Exchange WS Configs ---
    const WS_CONFIG = {
        binance: {
            futuresUrl: "wss://fstream.binance.com/ws",
            spotUrl: "wss://stream.binance.com:9443/ws",
            subMsg: (t, m) => JSON.stringify({method: "SUBSCRIBE", params: [`${t.toLowerCase()}usdt@bookTicker`], id: 1}),
            unsubMsg: (t, m) => JSON.stringify({method: "UNSUBSCRIBE", params: [`${t.toLowerCase()}usdt@bookTicker`], id: 1})
        },
        bybit: {
            futuresUrl: "wss://stream.bybit.com/v5/public/linear",
            spotUrl: "wss://stream.bybit.com/v5/public/spot",
            subMsg: (t, m) => JSON.stringify({op: "subscribe", args: [`orderbook.1.${t.toUpperCase()}USDT`]}),
            unsubMsg: (t, m) => JSON.stringify({op: "unsubscribe", args: [`orderbook.1.${t.toUpperCase()}USDT`]})
        },
        okx: {
            futuresUrl: "wss://ws.okx.com:8443/ws/v5/public",
            spotUrl: "wss://ws.okx.com:8443/ws/v5/public",
            subMsg: (t, m) => JSON.stringify({op: "subscribe", args: [{channel: "bbo-tbt", instId: m==='futures'?`${t.toUpperCase()}-USDT-SWAP`:`${t.toUpperCase()}-USDT`}]}),
            unsubMsg: (t, m) => JSON.stringify({op: "unsubscribe", args: [{channel: "bbo-tbt", instId: m==='futures'?`${t.toUpperCase()}-USDT-SWAP`:`${t.toUpperCase()}-USDT`}]})
        },
        bitget: {
            futuresUrl: "wss://ws.bitget.com/mix/v1/stream",
            spotUrl: "wss://ws.bitget.com/spot/v1/stream",
            subMsg: (t, m) => JSON.stringify({op: "subscribe", args: [{instType: m==='futures'?'UMCBL':'SPBL', channel: "books1", instId: m==='futures'?`${t.toUpperCase()}USDT_UMCBL`:`${t.toUpperCase()}USDT_SPBL`}]}),
            unsubMsg: (t, m) => JSON.stringify({op: "unsubscribe", args: [{instType: m==='futures'?'UMCBL':'SPBL', channel: "books1", instId: m==='futures'?`${t.toUpperCase()}USDT_UMCBL`:`${t.toUpperCase()}USDT_SPBL`}]})
        },
        gate: {
            futuresUrl: "wss://fx-ws.gateio.ws/v4/ws/usdt",
            spotUrl: "wss://api.gateio.ws/ws/v4/",
            subMsg: (t, m) => JSON.stringify({time: Math.floor(Date.now()/1000), channel: m==='futures'?"futures.book_ticker":"spot.book_ticker", event: "subscribe", payload: [`${t.toUpperCase()}_USDT`]}),
            unsubMsg: (t, m) => JSON.stringify({time: Math.floor(Date.now()/1000), channel: m==='futures'?"futures.book_ticker":"spot.book_ticker", event: "unsubscribe", payload: [`${t.toUpperCase()}_USDT`]})
        },
        hyperliquid: {
            futuresUrl: "wss://api.hyperliquid.xyz/ws",
            spotUrl: "wss://api.hyperliquid.xyz/ws",
            subMsg: (t, m) => JSON.stringify({method: "subscribe", subscription: {type: "l2Book", coin: t.toUpperCase()}}),
            unsubMsg: (t, m) => JSON.stringify({method: "unsubscribe", subscription: {type: "l2Book", coin: t.toUpperCase()}})
        },
        bingx: {
            futuresUrl: "wss://open-api-swap.bingx.com/swap-market",
            spotUrl: "wss://open-api-ws.bingx.com/market",
            subMsg: (t, m) => JSON.stringify({id: "1", reqType: "sub", dataType: m==='futures'?`${t.toUpperCase()}-USDT@bookTicker`:`${t.toUpperCase()}-USDT@ticker`}),
            unsubMsg: (t, m) => JSON.stringify({id: "1", reqType: "unsub", dataType: m==='futures'?`${t.toUpperCase()}-USDT@bookTicker`:`${t.toUpperCase()}-USDT@ticker`})
        },
        kucoin: {
            futuresUrl: "", // Dynamic
            spotUrl: "", // Dynamic
            subMsg: (t, m) => {
                const kt = m==='futures' && t.toUpperCase()==='BTC' ? 'XBT' : t.toUpperCase();
                return JSON.stringify({id: Date.now(), type: "subscribe", topic: m==='futures'?`/contractMarket/tickerV2:${kt}USDTM`:`/market/ticker:${t.toUpperCase()}-USDT`, privateChannel: false});
            },
            unsubMsg: (t, m) => {
                const kt = m==='futures' && t.toUpperCase()==='BTC' ? 'XBT' : t.toUpperCase();
                return JSON.stringify({id: Date.now(), type: "unsubscribe", topic: m==='futures'?`/contractMarket/tickerV2:${kt}USDTM`:`/market/ticker:${t.toUpperCase()}-USDT`, privateChannel: false});
            }
        },
        htx: {
            futuresUrl: "wss://api.hbdm.com/linear-swap-ws",
            spotUrl: "wss://api.huobi.pro/ws",
            subMsg: (t, m) => JSON.stringify({sub: m==='futures'?`market.${t.toUpperCase()}-USDT.bbo`:`market.${t.toLowerCase()}usdt.bbo`, id: "1"}),
            unsubMsg: (t, m) => JSON.stringify({unsub: m==='futures'?`market.${t.toUpperCase()}-USDT.bbo`:`market.${t.toLowerCase()}usdt.bbo`, id: "1"})
        },
        bitmart: {
            futuresUrl: "wss://openapi-ws-v2.bitmart.com/api?protocol=1.1",
            spotUrl: "wss://ws-manager-compress.bitmart.com/api?protocol=1.1",
            subMsg: (t, m) => JSON.stringify(m==='futures'?{"action":"subscribe","args":[`futures/ticker:${t.toUpperCase()}USDT`]}:{"op":"subscribe","args":[`spot/ticker:${t.toUpperCase()}_USDT`]}),
            unsubMsg: (t, m) => JSON.stringify(m==='futures'?{"action":"unsubscribe","args":[`futures/ticker:${t.toUpperCase()}USDT`]}:{"op":"unsubscribe","args":[`spot/ticker:${t.toUpperCase()}_USDT`]})
        },
        coinex: {
            futuresUrl: "wss://socket.coinex.com/v2/futures",
            spotUrl: "wss://socket.coinex.com/v2/spot",
            subMsg: (t, m) => JSON.stringify({"method": "bbo.subscribe", "params": {"market_list": [`${t.toUpperCase()}USDT`]}, "id": 1}),
            unsubMsg: (t, m) => JSON.stringify({"method": "bbo.unsubscribe", "params": {"market_list": [`${t.toUpperCase()}USDT`]}, "id": 1})
        },
        aster: {
            futuresUrl: "wss://fstream.asterdex.com/ws",
            spotUrl: "wss://fstream.asterdex.com/ws",
            subMsg: (t, m) => JSON.stringify({method: "SUBSCRIBE", params: [`${t.toLowerCase()}usdt@bookTicker`], id: 1}),
            unsubMsg: (t, m) => JSON.stringify({method: "UNSUBSCRIBE", params: [`${t.toLowerCase()}usdt@bookTicker`], id: 1})
        }
    };

    // Global WS connections object
    const activeSockets = {};

    function getSocketKey(exchange, marketType) {
        return `${exchange}_${marketType}`;
    }

    async function connectExchangeWS(exchange, marketType) {
        const key = getSocketKey(exchange, marketType);
        if (activeSockets[key] && activeSockets[key].ws && activeSockets[key].ws.readyState === WebSocket.OPEN) return activeSockets[key].ws;

        const cfg = WS_CONFIG[exchange];
        if (!cfg) return null;

        if (!activeSockets[key]) {
            activeSockets[key] = { ws: { readyState: 0 }, subs: new Set() };
        }

        let url = marketType === 'futures' ? cfg.futuresUrl : cfg.spotUrl;

        if (exchange === 'kucoin') {
            const tokenUrl = marketType === 'futures' ? "https://api-futures.kucoin.com/api/v1/bullet-public" : "https://api.kucoin.com/api/v1/bullet-public";
            try {
                let res = await fetch(tokenUrl, {method: "POST"});
                let data = await res.json();
                if (data && data.data && data.data.token) {
                    url = `${data.data.instanceServers[0].endpoint}?token=${data.data.token}`;
                } else throw new Error("No token");
            } catch(e) { 
                try {
                    const proxyRes = await fetch("https://corsproxy.io/?" + encodeURIComponent(tokenUrl), {method: "POST"});
                    const proxyData = await proxyRes.json();
                    if (proxyData && proxyData.data && proxyData.data.token) {
                        url = `${proxyData.data.instanceServers[0].endpoint}?token=${proxyData.data.token}`;
                    } else return null;
                } catch(err) { console.error("Kucoin Token Error:", err); return null; }
            }
        }

        console.log(`Connecting to ${exchange} ${marketType}...`);
        const ws = new WebSocket(url);
        if (exchange === 'bingx' || exchange === 'htx' || exchange === 'coinex') ws.binaryType = 'arraybuffer';
        
        activeSockets[key].ws = ws;

        ws.onopen = () => {
            console.log(`WSS Connected: ${exchange} ${marketType}`);
            if (exchange === 'kucoin') {
                activeSockets[key].pingInt = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({id: Date.now(), type: 'ping'}));
                }, 10000);
            } else if (exchange === 'hyperliquid') {
                activeSockets[key].pingInt = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({method: 'ping'}));
                }, 15000);
            } else if (exchange === 'coinex') {
                activeSockets[key].pingInt = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({method: 'server.ping', params: {}, id: Date.now()}));
                }, 20000);
            } else if (exchange === 'gate') {
                activeSockets[key].pingInt = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            time: Math.floor(Date.now() / 1000),
                            channel: marketType === 'futures' ? "futures.ping" : "spot.ping",
                            event: "ping"
                        }));
                    }
                }, 15000);
            }
            activeSockets[key].subs.forEach(ticker => {
                ws.send(cfg.subMsg(ticker, marketType));
            });
        };

        ws.onmessage = async (e) => {
            let payloadStr = e.data;
            if (e.data instanceof ArrayBuffer) {
                try {
                    const decompressed = pako.ungzip(new Uint8Array(e.data));
                    payloadStr = new TextDecoder().decode(decompressed);
                } catch(err) { console.error("Pako error:", err); return; }
            }
            if (payloadStr === 'Ping') { ws.send('Pong'); return; }
            handleWSPayload(exchange, marketType, payloadStr);
        };

        ws.onclose = () => {
            console.log(`WSS Closed: ${exchange} ${marketType}. Reconnecting in 3s...`);
            if (activeSockets[key] && activeSockets[key].pingInt) clearInterval(activeSockets[key].pingInt);
            setTimeout(() => connectExchangeWS(exchange, marketType), 3000);
        };

        return ws;
    }

    function handleWSPayload(exchange, marketType, payloadStr) {
        try {
            const data = JSON.parse(payloadStr);
            if (data.ping) { activeSockets[getSocketKey(exchange, marketType)].ws.send(JSON.stringify({pong: data.ping})); return; }

            let price = null;
            let rawTicker = null;

            if ((exchange === 'binance' || exchange === 'aster') && (data.e === 'bookTicker' || (!data.e && data.u && data.s && data.b && data.a))) {
                rawTicker = data.s;
                price = (parseFloat(data.b) + parseFloat(data.a)) / 2;
            } else if (exchange === 'bybit' && data.topic && data.topic.startsWith('orderbook.1.')) {
                if (data.data && data.data.b && data.data.b.length > 0 && data.data.a && data.data.a.length > 0) {
                    rawTicker = data.data.s;
                    price = (parseFloat(data.data.b[0][0]) + parseFloat(data.data.a[0][0])) / 2;
                }
            } else if (exchange === 'okx' && data.arg && data.arg.channel === 'bbo-tbt') {
                if (data.data && data.data[0] && data.data[0].bids.length > 0 && data.data[0].asks.length > 0) {
                    rawTicker = data.arg.instId;
                    price = (parseFloat(data.data[0].bids[0][0]) + parseFloat(data.data[0].asks[0][0])) / 2;
                }
            } else if (exchange === 'bitget' && data.arg && data.arg.channel === 'books1') {
                if (data.data && data.data[0] && data.data[0].bids.length > 0 && data.data[0].asks.length > 0) {
                    rawTicker = data.arg.instId;
                    price = (parseFloat(data.data[0].bids[0][0]) + parseFloat(data.data[0].asks[0][0])) / 2;
                }
            } else if (exchange === 'gate' && data.event === 'update' && (data.channel === 'futures.book_ticker' || data.channel === 'spot.book_ticker')) {
                if (data.result && data.result.b && data.result.a) {
                    rawTicker = data.result.s;
                    price = (parseFloat(data.result.b) + parseFloat(data.result.a)) / 2;
                }
            } else if (exchange === 'hyperliquid' && data.channel === 'l2Book') {
                if (data.data && data.data.levels && data.data.levels[0] && data.data.levels[1]) {
                    rawTicker = data.data.coin;
                    let bid = data.data.levels[0][0];
                    let ask = data.data.levels[1][0];
                    if (bid && ask && bid.px && ask.px) {
                        price = (parseFloat(bid.px) + parseFloat(ask.px)) / 2;
                    }
                }
            } else if (exchange === 'bingx' && data.dataType && data.dataType.includes('@bookTicker')) {
                if (data.data && data.data.b && data.data.a) {
                    rawTicker = data.dataType.split('-')[0];
                    price = (parseFloat(data.data.b) + parseFloat(data.data.a)) / 2;
                }
            } else if (exchange === 'kucoin' && data.type === 'message' && data.subject && data.subject.includes('ticker')) {
                if (data.data) {
                    const bBid = data.data.bestBid || data.data.bestBidPrice;
                    const bAsk = data.data.bestAsk || data.data.bestAskPrice;
                    if (bBid && bAsk) {
                        rawTicker = data.topic.split(':')[1].replace('USDTM','').replace('-USDT','');
                        if (rawTicker === 'XBT') rawTicker = 'BTC';
                        price = (parseFloat(bBid) + parseFloat(bAsk)) / 2;
                    }
                }
            } else if (exchange === 'htx' && data.ch && data.ch.includes('.bbo')) {
                if (data.tick && data.tick.bid && data.tick.ask) {
                    rawTicker = data.ch.split('.')[1].replace('-USDT','').replace('usdt','');
                    price = (parseFloat(data.tick.bid[0]) + parseFloat(data.tick.ask[0])) / 2;
                }
            } else if (exchange === 'bitmart') {
                if (data.data && Array.isArray(data.data) && data.data[0] && data.data[0].symbol) {
                    rawTicker = data.data[0].symbol;
                    if (data.data[0].bid_px && data.data[0].ask_px) price = (parseFloat(data.data[0].bid_px) + parseFloat(data.data[0].ask_px)) / 2;
                } else if (data.data && data.data.symbol && data.data.bid_price && data.data.ask_price) {
                    rawTicker = data.data.symbol;
                    price = (parseFloat(data.data.bid_price) + parseFloat(data.data.ask_price)) / 2;
                }
            } else if (exchange === 'coinex' && data.method === 'bbo.update' && data.data) {
                if (data.data.market && data.data.best_bid_price && data.data.best_ask_price) {
                    rawTicker = data.data.market;
                    price = (parseFloat(data.data.best_bid_price) + parseFloat(data.data.best_ask_price)) / 2;
                }
            }

            if (price && rawTicker) {
                // Normalize ticker to extract base coin (e.g., BTCUSDT_UMCBL -> BTC)
                let coin = rawTicker.toUpperCase().replace(/[-_]/g, '').replace('USDT', '').replace('SWAP', '').replace('UMCBL', '').replace('SPBL', '');
                updateCardsWithPrice(exchange, marketType, coin, price);
            }
        } catch (err) {}
    }

    function updateCardsWithPrice(exchange, marketType, coin, price) {
        document.querySelectorAll('.position-card').forEach(card => {
            const shortEx = card.querySelector('.short-exchange').value;
            const longEx = card.querySelector('.long-exchange').value;
            const shortMarket = card.querySelector('.short-market').value;
            const longMarket = card.querySelector('.long-market').value;
            const shortTicker = card.querySelector('.short-ticker').value.trim().toUpperCase();
            const longTicker = card.querySelector('.long-ticker').value.trim().toUpperCase();
            
            let updated = false;
            // Убираем артефакты плавающей запятой (например 1.999999998)
            const formattedPrice = parseFloat(price.toFixed(10));

            if (shortEx === exchange && shortMarket === marketType && shortTicker === coin) {
                const input = card.querySelector('.current-a');
                input.value = formattedPrice;
                updated = true;
            }

            if (longEx === exchange && longMarket === marketType && longTicker === coin) {
                const input = card.querySelector('.current-b');
                input.value = formattedPrice;
                updated = true;
            }
            if (updated) calculateCard(card);
        });
    }

    function subscribeWSS(exchange, marketType, ticker) {
        if (!ticker || !WS_CONFIG[exchange]) return;
        ticker = ticker.toUpperCase();
        
        const key = getSocketKey(exchange, marketType);
        if (!activeSockets[key]) {
            connectExchangeWS(exchange, marketType);
        }

        const sockData = activeSockets[key];
        if (!sockData.subs.has(ticker)) {
            sockData.subs.add(ticker);
            if (sockData.ws.readyState === WebSocket.OPEN) {
                sockData.ws.send(WS_CONFIG[exchange].subMsg(ticker, marketType));
            }
        }
    }


    // --- REST Fallback and Proxies ---
    const CORS_PROXY = "https://api.codetabs.com/v1/proxy?quest=";

    async function fetchRESTJSON(url) {
        try {
            const res = await fetch(CORS_PROXY + encodeURIComponent(url));
            return await res.json();
        } catch (e) {
            console.error("REST Proxy error:", e);
            return null;
        }
    }

    // Interval for exchanges without native WSS implemented here
    setInterval(() => {
        document.querySelectorAll('.position-card').forEach(card => {
            const shortEx = card.querySelector('.short-exchange').value;
            const longEx = card.querySelector('.long-exchange').value;
            const shortMarket = card.querySelector('.short-market').value;
            const longMarket = card.querySelector('.long-market').value;
            const shortTicker = card.querySelector('.short-ticker').value.trim();
            const longTicker = card.querySelector('.long-ticker').value.trim();
            
            const shortWsKey = getSocketKey(shortEx, shortMarket);
            const longWsKey = getSocketKey(longEx, longMarket);

            // Fail-safe: Если биржа из красной зоны (нет WS_CONFIG), или вебсокет отвалился/не смог подключиться - опрашиваем через REST
            if (shortTicker && (!WS_CONFIG[shortEx] || !activeSockets[shortWsKey] || activeSockets[shortWsKey].ws.readyState !== WebSocket.OPEN)) {
                pollRestPrice(shortEx, shortTicker, shortMarket, card.querySelector('.current-a'), card);
            }
            if (longTicker && (!WS_CONFIG[longEx] || !activeSockets[longWsKey] || activeSockets[longWsKey].ws.readyState !== WebSocket.OPEN)) {
                pollRestPrice(longEx, longTicker, longMarket, card.querySelector('.current-b'), card);
            }
        });
    }, 5000);

    async function pollRestPrice(exchange, ticker, marketType, inputEl, card) {
        if (!ticker) return;
        ticker = ticker.toUpperCase();
        let price = null;
        try {
            if (exchange === "hyperliquid") {
                const res = await fetch("https://api.hyperliquid.xyz/info", {
                    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({type: "allMids"})
                });
                const data = await res.json();
                if (data[ticker]) price = parseFloat(data[ticker]);
            } else if (exchange === 'kucoin') {
                let res, data;
                if (marketType === 'futures') {
                    res = await fetch(`https://api.codetabs.com/v1/proxy?quest=` + encodeURIComponent(`https://api-futures.kucoin.com/api/v1/ticker?symbol=${ticker}USDTM`));
                    data = await res.json();
                    if (data && data.data) price = parseFloat(data.data.price);
                } else {
                    res = await fetch(`https://api.codetabs.com/v1/proxy?quest=` + encodeURIComponent(`https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${ticker}-USDT`));
                    data = await res.json();
                    if (data && data.data) price = parseFloat(data.data.price);
                }
            } else if (exchange === 'bitmart') {
                let url = marketType === 'futures' ? `https://api-cloud.bitmart.com/contract/public/details?symbol=${ticker}USDT` : `https://api-cloud.bitmart.com/spot/v1/ticker?symbol=${ticker}_USDT`;
                const data = await fetchRESTJSON(`https://api.codetabs.com/v1/proxy?quest=` + encodeURIComponent(url));
                if (data && data.data) price = parseFloat(data.data.tickers?.[0]?.last_price || data.data.last_price);
            } else if (exchange === 'coinex') {
                let url = marketType === 'futures' ? `https://api.coinex.com/v2/futures/ticker?market=${ticker}USDT` : `https://api.coinex.com/v2/spot/ticker?market=${ticker}USDT`;
                const data = await fetchRESTJSON(`https://api.codetabs.com/v1/proxy?quest=` + encodeURIComponent(url));
                if (data && data.data && data.data[0]) price = parseFloat(data.data[0].last);
            } else if (exchange === "bingx") {
                let url = marketType === 'futures' ? `https://open-api.bingx.com/openApi/swap/v2/quote/ticker?symbol=${ticker}-USDT` : `https://open-api.bingx.com/openApi/spot/v1/ticker/24hr?symbol=${ticker}-USDT`;
                const data = await fetchRESTJSON(url);
                if (data && data.data && data.data.lastPrice) price = parseFloat(data.data.lastPrice);
                if (data && data.data && data.data[0] && data.data[0].lastPrice) price = parseFloat(data.data[0].lastPrice);
            } else if (exchange === "htx") {
                let url = marketType === 'futures' ? `https://api.hbdm.com/linear-swap-ex/market/detail/merged?contract_code=${ticker}-USDT` : `https://api.huobi.pro/market/detail/merged?symbol=${ticker.toLowerCase()}usdt`;
                const data = await fetchRESTJSON(url);
                if (data && data.tick) price = parseFloat(data.tick.close);
            }
        } catch(e){}

        if (price !== null && document.activeElement !== inputEl) {
            inputEl.value = price;
            calculateCard(card);
        }
    }


    // --- Funding Logic ---
    async function fetchHistoricalFunding(exchange, ticker, startTime, marketType) {
        if (!startTime || isNaN(startTime) || marketType === 'spot') return { sum: 0, count: 0, currentRate: 0, history: [] };
        ticker = ticker.toUpperCase();
        
        let sum = 0, count = 0, currentRate = 0;
        let history = [];

        try {
            if (exchange === "binance" || exchange === "aster") {
                const baseUrl = exchange === "aster" ? "https://fapi.asterdex.com" : "https://fapi.binance.com";
                const [histData, curData] = await Promise.all([
                    fetchRESTJSON(`${baseUrl}/fapi/v1/fundingRate?symbol=${ticker}USDT&startTime=${startTime}&limit=1000`),
                    fetchRESTJSON(`${baseUrl}/fapi/v1/premiumIndex?symbol=${ticker}USDT`)
                ]);
                if (histData && Array.isArray(histData)) {
                    sum = histData.reduce((a,b)=>a+parseFloat(b.fundingRate), 0);
                    count = histData.length;
                    history = histData.map(b => ({ time: parseInt(b.fundingTime), rate: parseFloat(b.fundingRate) }));
                }
                if (curData && curData.lastFundingRate) currentRate = parseFloat(curData.lastFundingRate);
            } else if (exchange === "hyperliquid") {
                 const res = await fetch("https://api.hyperliquid.xyz/info", {
                    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({type: "fundingHistory", coin: ticker, startTime: startTime})
                });
                const data = await res.json();
                if (data && Array.isArray(data)) {
                    sum = data.reduce((a,b)=>a+parseFloat(b.fundingRate), 0);
                    count = data.length;
                    history = data.map(b => ({ time: parseInt(b.time), rate: parseFloat(b.fundingRate) }));
                }
            } else if (exchange === "bitget") {
                const [histData, curData] = await Promise.all([
                    fetchRESTJSON(`https://api.bitget.com/api/mix/v1/market/history-fundRate?symbol=${ticker}USDT_UMCBL&pageSize=100&pageNo=1`),
                    fetchRESTJSON(`https://api.bitget.com/api/mix/v1/market/ticker?symbol=${ticker}USDT_UMCBL`)
                ]);
                if (histData && histData.data && histData.data.resultList) {
                    const valid = histData.data.resultList.filter(i => parseInt(i.settleTime) >= startTime);
                    sum = valid.reduce((a,b)=>a+parseFloat(b.fundingRate), 0);
                    count = valid.length;
                    history = valid.map(b => ({ time: parseInt(b.settleTime), rate: parseFloat(b.fundingRate) }));
                }
                if (curData && curData.data && curData.data.fundingRate) currentRate = parseFloat(curData.data.fundingRate);
            } else if (exchange === "bybit") {
                const [histData, curData] = await Promise.all([
                    fetchRESTJSON(`https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${ticker}USDT&startTime=${startTime}`),
                    fetchRESTJSON(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${ticker}USDT`)
                ]);
                if (histData && histData.result && histData.result.list) {
                    sum = histData.result.list.reduce((a,b)=>a+parseFloat(b.fundingRate), 0);
                    count = histData.result.list.length;
                    history = histData.result.list.map(b => ({ time: parseInt(b.fundingRateTimestamp), rate: parseFloat(b.fundingRate) }));
                }
                if (curData && curData.result && curData.result.list && curData.result.list[0]) {
                    currentRate = parseFloat(curData.result.list[0].fundingRate);
                }
            } else {
                // Fallback estimation
                const periods = parseInt((Date.now() - startTime) / (1000*60*60*8));
                sum = 0.0001 * periods;
                count = periods;
                currentRate = 0.0001;
            }
        } catch (e) {
            console.error(`Funding Error for ${exchange}:`, e);
        }
        
        return { sum, count, currentRate, history };
    }

    async function fetchFundingForCard(card) {
        const openTimeInput = card.querySelector('.open-time').value;
        if (!openTimeInput) return;
        
        const startTime = new Date(openTimeInput).getTime();
        const shortEx = card.querySelector('.short-exchange').value;
        const shortMarket = card.querySelector('.short-market').value;
        const longEx = card.querySelector('.long-exchange').value;
        const longMarket = card.querySelector('.long-market').value;
        const shortTicker = card.querySelector('.short-ticker').value.trim();
        const longTicker = card.querySelector('.long-ticker').value.trim();

        let shortFunding = { sum: 0, count: 0, currentRate: 0, history: [] };
        let longFunding = { sum: 0, count: 0, currentRate: 0, history: [] };

        if (shortTicker) shortFunding = await fetchHistoricalFunding(shortEx, shortTicker, startTime, shortMarket);
        if (longTicker) longFunding = await fetchHistoricalFunding(longEx, longTicker, startTime, longMarket);

        card.dataset.shortFundingSum = shortFunding.sum;
        card.dataset.longFundingSum = longFunding.sum;
        card.dataset.shortFundingCount = shortFunding.count;
        card.dataset.longFundingCount = longFunding.count;
        card.dataset.shortFundingRate = shortFunding.currentRate;
        card.dataset.longFundingRate = longFunding.currentRate;
        card.dataset.shortFundingHistory = JSON.stringify(shortFunding.history);
        card.dataset.longFundingHistory = JSON.stringify(longFunding.history);

        calculateCard(card);
    }


    // --- UI Init and Event Listeners ---
    addCard();

    addCardBtn.addEventListener('click', addCard);

    function triggerWSSubscription(card) {
        const shortEx = card.querySelector('.short-exchange').value;
        const shortMarket = card.querySelector('.short-market').value;
        const shortTicker = card.querySelector('.short-ticker').value.trim();
        if (shortTicker) subscribeWSS(shortEx, shortMarket, shortTicker);

        const longEx = card.querySelector('.long-exchange').value;
        const longMarket = card.querySelector('.long-market').value;
        const longTicker = card.querySelector('.long-ticker').value.trim();
        if (longTicker) subscribeWSS(longEx, longMarket, longTicker);
    }

    function addCard() {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.position-card');
        
        card.querySelector('.close-btn').addEventListener('click', () => card.remove());

        const inputs = card.querySelectorAll('input, select');
        inputs.forEach(input => {
            if (!input.classList.contains('search-coin') && !input.classList.contains('short-ticker') && !input.classList.contains('long-ticker')) {
                input.addEventListener('input', () => calculateCard(card));
                input.addEventListener('change', () => calculateCard(card));
            }
        });
        
        // Связываем верхнее поле SEARCH COIN с обоими тикерами для моментального ввода
        const searchCoin = card.querySelector('.search-coin');
        const shortTicker = card.querySelector('.short-ticker');
        const longTicker = card.querySelector('.long-ticker');
        
        searchCoin.addEventListener('input', (e) => {
            const val = e.target.value.trim().toUpperCase();
            shortTicker.value = val;
            longTicker.value = val;
            card.querySelector('.current-a').value = '';
            card.querySelector('.current-b').value = '';
            triggerWSSubscription(card);
            calculateCard(card);
        });
        
        shortTicker.addEventListener('input', () => { 
            card.querySelector('.current-a').value = '';
            triggerWSSubscription(card); 
            calculateCard(card); 
        });
        longTicker.addEventListener('input', () => { 
            card.querySelector('.current-b').value = '';
            triggerWSSubscription(card); 
            calculateCard(card); 
        });

        const triggerFundingInputs = card.querySelectorAll('.open-time, .short-ticker, .long-ticker, .short-exchange, .long-exchange, .short-market, .long-market');
        triggerFundingInputs.forEach(input => {
            input.addEventListener('change', () => {
                fetchFundingForCard(card);
            });
        });

        const shortExSelect = card.querySelector('.short-exchange');
        const longExSelect = card.querySelector('.long-exchange');
        
        shortExSelect.addEventListener('change', (e) => {
            card.querySelectorAll('.short-ex-label').forEach(lbl => lbl.textContent = e.target.options[e.target.selectedIndex].text.toUpperCase());
            triggerWSSubscription(card);
        });
        
        longExSelect.addEventListener('change', (e) => {
            card.querySelectorAll('.long-ex-label').forEach(lbl => lbl.textContent = e.target.options[e.target.selectedIndex].text.toUpperCase());
            triggerWSSubscription(card);
        });
        
        card.fundingInterval = setInterval(() => fetchFundingForCard(card), 60000);

        dashboard.appendChild(card);
        shortExSelect.dispatchEvent(new Event('change'));
        longExSelect.dispatchEvent(new Event('change'));
    }

    // --- Math & Rendering ---
    function formatMoney(value, includeSign = true) {
        if (isNaN(value)) return '$0.00';
        const sign = value > 0 && includeSign ? '+' : '';
        return `${sign}$${value.toFixed(2)}`;
    }

    function formatSpread(value) {
        if (isNaN(value)) return '0.0000';
        const sign = value > 0 ? '+' : '';
        return `${sign}${value.toFixed(4)}`;
    }

    function formatPct(value) {
        if (isNaN(value) || !isFinite(value)) return '(0.00%)';
        const sign = value > 0 ? '+' : '';
        return `(${sign}${value.toFixed(2)}%)`;
    }

    function applyColor(element, value) {
        element.classList.remove('val-green', 'val-red');
        if (value > 0) element.classList.add('val-green');
        else if (value < 0) element.classList.add('val-red');
    }

    function calculateCard(card) {
        const entryA = parseFloat(card.querySelector('.entry-a').value) || 0;
        const entryB = parseFloat(card.querySelector('.entry-b').value) || 0;
        const amount = parseFloat(card.querySelector('.amount').value) || 0;
        
        const closeAInput = card.querySelector('.close-a').value;
        const closeBInput = card.querySelector('.close-b').value;

        const currentA = parseFloat(card.querySelector('.current-a').value) || 0;
        const currentB = parseFloat(card.querySelector('.current-b').value) || 0;

        const useCloseA = closeAInput !== '';
        const useCloseB = closeBInput !== '';

        const priceA = useCloseA ? parseFloat(closeAInput) : currentA;
        const priceB = useCloseB ? parseFloat(closeBInput) : currentB;

        const entrySpread = entryA - entryB;
        const curSpread = priceA - priceB;
        
        const shortPnl = (entryA - priceA) * amount;
        const longPnl = (priceB - entryB) * amount;
        const spreadPnl = shortPnl + longPnl;

        const shortFundingSum = parseFloat(card.dataset.shortFundingSum) || 0;
        const longFundingSum = parseFloat(card.dataset.longFundingSum) || 0;
        const shortFundingCount = parseInt(card.dataset.shortFundingCount) || 0;
        const longFundingCount = parseInt(card.dataset.longFundingCount) || 0;
        const shortFundingRate = parseFloat(card.dataset.shortFundingRate) || 0;
        const longFundingRate = parseFloat(card.dataset.longFundingRate) || 0;

        const shortFundingPnl = amount * entryA * shortFundingSum;
        const longFundingPnl = -(amount * entryB * longFundingSum);
        const funding = shortFundingPnl + longFundingPnl;

        const totalPnl = spreadPnl + funding;
        const closePnl = (entrySpread * amount) + funding;

        const entrySpreadPct = entryB !== 0 ? (entrySpread / entryB) * 100 : 0;
        const curSpreadPct = priceB !== 0 ? (curSpread / priceB) * 100 : 0;

        // Liquidation Calculation (Isolated)
        const balanceA = parseFloat(card.querySelector('.balance-a').value) || 0;
        const balanceB = parseFloat(card.querySelector('.balance-b').value) || 0;

        let liqA = '-';
        if (amount > 0 && balanceA > 0 && entryA > 0) {
            liqA = entryA + (balanceA / amount);
        }
        let liqB = '-';
        if (amount > 0 && balanceB > 0 && entryB > 0) {
            liqB = entryB - (balanceB / amount);
            if (liqB <= 0) liqB = 0;
        }

        card.querySelector('.liq-a-val').textContent = liqA !== '-' ? liqA.toFixed(6) : '-';
        card.querySelector('.liq-b-val').textContent = liqB !== '-' ? liqB.toFixed(6) : '-';

        card.querySelector('.entry-spread-val').textContent = formatSpread(entrySpread);
        card.querySelector('.entry-spread-pct').textContent = formatPct(entrySpreadPct);
        applyColor(card.querySelector('.entry-spread-val'), entrySpread);
        applyColor(card.querySelector('.entry-spread-pct'), entrySpreadPct);

        card.querySelector('.cur-spread-val').textContent = formatSpread(curSpread);
        card.querySelector('.cur-spread-pct').textContent = formatPct(curSpreadPct);
        applyColor(card.querySelector('.cur-spread-val'), curSpread);
        applyColor(card.querySelector('.cur-spread-pct'), curSpreadPct);

        card.querySelector('.short-pnl-val').textContent = formatMoney(shortPnl);
        applyColor(card.querySelector('.short-pnl-val'), shortPnl);

        card.querySelector('.long-pnl-val').textContent = formatMoney(longPnl);
        applyColor(card.querySelector('.long-pnl-val'), longPnl);

        const formatHistoryTitle = (historyStr, exName) => {
            if (!historyStr) return 'No history';
            try {
                const arr = JSON.parse(historyStr);
                if (!arr || arr.length === 0) return 'No payments yet';
                arr.sort((a,b) => b.time - a.time);
                let text = `--- ${exName} ---\n`;
                text += arr.map(item => {
                    const d = new Date(item.time);
                    const ds = d.toLocaleString('ru-RU', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
                    const rate = (item.rate > 0 ? '+' : '') + (item.rate * 100).toFixed(4);
                    return `${ds}    ${rate}%`;
                }).join('\n');
                return text;
            } catch(e) {
                return 'No history';
            }
        };

        const shortExLabel = card.querySelector('.short-ex-label').textContent;
        const longExLabel = card.querySelector('.long-ex-label').textContent;
        const histA = formatHistoryTitle(card.dataset.shortFundingHistory, shortExLabel);
        const histB = formatHistoryTitle(card.dataset.longFundingHistory, longExLabel);

        const fundingPnlEl = card.querySelector('.funding-pnl-val');
        fundingPnlEl.textContent = formatMoney(funding);
        card.querySelector('.funding-pnl-tooltip').textContent = `${histA}\n\n${histB}`;
        applyColor(fundingPnlEl, funding);
        
        const fRateA = card.querySelector('.funding-rate-a');
        fRateA.textContent = (shortFundingRate * 100).toFixed(4) + '%';
        card.querySelector('.funding-rate-a-tooltip').textContent = `Accrued: ${(shortFundingSum * 100).toFixed(4)}%\n\n${histA}`;
        applyColor(fRateA, shortFundingRate);
        
        const fRateB = card.querySelector('.funding-rate-b');
        fRateB.textContent = (longFundingRate * 100).toFixed(4) + '%';
        card.querySelector('.funding-rate-b-tooltip').textContent = `Accrued: ${(longFundingSum * 100).toFixed(4)}%\n\n${histB}`;
        applyColor(fRateB, longFundingRate);

        card.querySelector('.spread-pnl-total').textContent = formatMoney(spreadPnl);
        applyColor(card.querySelector('.spread-pnl-total'), spreadPnl);

        card.querySelector('.total-pnl').textContent = formatMoney(totalPnl);
        applyColor(card.querySelector('.total-pnl'), totalPnl);

        card.querySelector('.close-pnl').textContent = formatMoney(closePnl);
        applyColor(card.querySelector('.close-pnl'), closePnl);
    }
});
