import asyncio
import json
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import httpx
import ccxt.pro as ccxtpro
import traceback

app = FastAPI(title="Crypto Scanner Live WSS")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

active_connections = []
active_tasks = {}
exchanges = {}

EXCHANGE_MAP = {
    "binance_futures": {"id": "binanceusdm"},
    "binance_spot": {"id": "binance"},
    "bybit_futures": {"id": "bybit", "options": {"defaultType": "swap"}},
    "bybit_spot": {"id": "bybit", "options": {"defaultType": "spot"}},
    "okx_futures": {"id": "okx", "options": {"defaultType": "swap"}},
    "okx_spot": {"id": "okx", "options": {"defaultType": "spot"}},
    "bitget_futures": {"id": "bitget", "options": {"defaultType": "swap"}},
    "bitget_spot": {"id": "bitget", "options": {"defaultType": "spot"}},
    "gate_futures": {"id": "gate", "options": {"defaultType": "swap"}},
    "gate_spot": {"id": "gate", "options": {"defaultType": "spot"}},
    "kucoin_futures": {"id": "kucoinfutures"},
    "kucoin_spot": {"id": "kucoin"},
    "bingx_futures": {"id": "bingx", "options": {"defaultType": "swap"}},
    "bingx_spot": {"id": "bingx", "options": {"defaultType": "spot"}},
    "htx_futures": {"id": "htx", "options": {"defaultType": "swap"}},
    "htx_spot": {"id": "htx", "options": {"defaultType": "spot"}},
    "bitmart_futures": {"id": "bitmart", "options": {"defaultType": "swap"}},
    "bitmart_spot": {"id": "bitmart", "options": {"defaultType": "spot"}},
    "coinex_futures": {"id": "coinex", "options": {"defaultType": "swap"}},
    "coinex_spot": {"id": "coinex", "options": {"defaultType": "spot"}},
    "phemex_futures": {"id": "phemex", "options": {"defaultType": "swap"}},
    "phemex_spot": {"id": "phemex", "options": {"defaultType": "spot"}},
}

async def get_or_create_exchange(ex_key):
    if ex_key not in exchanges:
        if ex_key not in EXCHANGE_MAP:
            return None
        cfg = EXCHANGE_MAP[ex_key]
        if not hasattr(ccxtpro, cfg["id"]):
            return None
            
        exchange_class = getattr(ccxtpro, cfg["id"])
        options = cfg.get("options", {})
        exchanges[ex_key] = exchange_class({
            'enableRateLimit': True,
            'options': options
        })
    return exchanges[ex_key]

def get_ccxt_symbol(ticker, market_type):
    ticker = ticker.upper().replace('USDT', '')
    if market_type == "futures":
        return f"{ticker}/USDT:USDT"
    else:
        return f"{ticker}/USDT"

async def watch_ticker_task(ex_key, symbol, original_exchange, original_ticker):
    ex = await get_or_create_exchange(ex_key)
    if not ex:
        print(f"CCXT Not Supported: {ex_key}")
        return

    try:
        # Load markets once
        if not ex.markets:
            await ex.load_markets()
            
        # Some exchanges like Bitget might use different conventions in CCXT
        ccxt_symbol = symbol
        if ccxt_symbol not in ex.markets:
            # Fallback attempts
            alts = [f"{original_ticker}/USDT", original_ticker]
            for alt in alts:
                if alt in ex.markets:
                    ccxt_symbol = alt
                    break

        print(f"Started WSS stream: {ex_key} - {ccxt_symbol}")
        while True:
            ticker_data = await ex.watch_ticker(ccxt_symbol)
            price = ticker_data['last']
            
            msg = json.dumps({
                "type": "price_update",
                "exchange": original_exchange,
                "ticker": original_ticker,
                "price": price
            })
            
            dead_connections = []
            for ws in active_connections:
                try:
                    await ws.send_text(msg)
                except Exception:
                    dead_connections.append(ws)
                    
            for ws in dead_connections:
                if ws in active_connections:
                    active_connections.remove(ws)
                    
    except Exception as e:
        print(f"WSS Error on {ex_key} for {symbol}: {e}")
        # Automatically restart task on crash after delay
        await asyncio.sleep(5)
        asyncio.create_task(watch_ticker_task(ex_key, symbol, original_exchange, original_ticker))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("action") == "subscribe":
                ex = msg.get("exchange")
                ticker = msg.get("ticker")
                mtype = msg.get("market_type")
                
                # Special cases not in CCXT Pro yet
                if ex in ["hyperliquid", "aster", "lighter", "ourbit", "weex", "xt"]:
                    continue # Use REST fallback for these (implement later if needed)

                ex_key = f"{ex}_{mtype}"
                ccxt_symbol = get_ccxt_symbol(ticker, mtype)
                task_key = f"{ex_key}_{ccxt_symbol}"
                
                if task_key not in active_tasks:
                    task = asyncio.create_task(watch_ticker_task(ex_key, ccxt_symbol, ex, ticker))
                    active_tasks[task_key] = task
                    
    except WebSocketDisconnect:
        active_connections.remove(websocket)
    except Exception as e:
        pass


# --- REST API for Funding and Rest Fallback ---
async def fetch_json(url, method="GET", json_body=None):
    async with httpx.AsyncClient() as client:
        try:
            if method == "GET":
                resp = await client.get(url, timeout=5.0)
            else:
                resp = await client.post(url, json=json_body, timeout=5.0)
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return None

@app.get("/api/price")
async def get_price(exchange: str, ticker: str, market_type: str = "futures"):
    # REST Fallback for exchanges not supported via CCXT Pro WSS (Hyperliquid, etc)
    exchange = exchange.lower()
    ticker = ticker.upper().strip()
    try:
        if exchange == "hyperliquid":
            data = await fetch_json("https://api.hyperliquid.xyz/info", method="POST", json_body={"type": "allMids"})
            clean_ticker = ticker.replace("USDT", "")
            return {"price": float(data[clean_ticker])} if data and clean_ticker in data else {"price": None}
            
        elif exchange == "weex":
            # Example REST for Weex
            data = await fetch_json(f"https://api.weex.com/api/v1/contract/ticker?symbol={ticker}")
            return {"price": float(data["data"]["lastPrice"])} if data and "data" in data else {"price": None}
            
        return {"price": None}
    except Exception:
        return {"price": None}

@app.get("/api/funding")
async def get_funding(exchange: str, ticker: str, start_time: int, market_type: str = "futures"):
    if market_type == "spot":
        return {"sum": 0, "count": 0}

    exchange = exchange.lower()
    ticker = ticker.upper().strip()

    try:
        if exchange == "binance":
            symbol = ticker if ticker.endswith("USDT") else f"{ticker}USDT"
            data = await fetch_json(f"https://fapi.binance.com/fapi/v1/fundingRate?symbol={symbol}&startTime={start_time}&limit=1000")
            if data:
                return {"sum": sum(float(i["fundingRate"]) for i in data), "count": len(data)}

        elif exchange == "hyperliquid":
            clean_ticker = ticker.replace("USDT", "")
            data = await fetch_json("https://api.hyperliquid.xyz/info", method="POST", json_body={"type": "fundingHistory", "coin": clean_ticker, "startTime": start_time})
            if data:
                return {"sum": sum(float(i["fundingRate"]) for i in data), "count": len(data)}

        elif exchange == "bitget":
            symbol = f"{ticker}_UMCBL" if ticker.endswith("USDT") else f"{ticker}USDT_UMCBL"
            data = await fetch_json(f"https://api.bitget.com/api/mix/v1/market/history-fundRate?symbol={symbol}&pageSize=100&pageNo=1")
            if data and data.get("data", {}).get("resultList"):
                valid = [float(i["fundingRate"]) for i in data["data"]["resultList"] if int(i["settleTime"]) >= start_time]
                return {"sum": sum(valid), "count": len(valid)}
        
        elif exchange == "bybit":
            symbol = ticker if ticker.endswith("USDT") else f"{ticker}USDT"
            data = await fetch_json(f"https://api.bybit.com/v5/market/funding/history?category=linear&symbol={symbol}&startTime={start_time}")
            if data and data.get("result", {}).get("list"):
                return {"sum": sum(float(i["fundingRate"]) for i in data["result"]["list"]), "count": len(data["result"]["list"])}

        elif exchange == "okx":
            symbol = f"{ticker}-USDT-SWAP" if not ticker.endswith("USDT") else f"{ticker.replace('USDT', '')}-USDT-SWAP"
            data = await fetch_json(f"https://www.okx.com/api/v5/public/funding-rate-history?instId={symbol}&limit=100")
            if data and data.get("data"):
                valid = [float(i["fundingRate"]) for i in data["data"] if int(i["fundingTime"]) >= start_time]
                return {"sum": sum(valid), "count": len(valid)}

        # Fallback estimator
        current_time = int(time.time() * 1000)
        hours_passed = (current_time - start_time) / (1000 * 60 * 60)
        periods = int(hours_passed / 8)
        return {"sum": 0.0001 * periods, "count": periods}

    except Exception as e:
        return {"sum": 0, "count": 0}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
