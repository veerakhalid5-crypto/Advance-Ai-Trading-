/* =========================================================
   ADVANCED CRYPTO AI
   APP ENGINE
========================================================= */

"use strict";

const API_BASE =
    "https://api.binance.com/api/v3/klines";

let state = {
    symbol: "BTCUSDT",
    interval: "1h",
    candles: [],
    live: true,
    timer: null
};


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);

function formatNumber(value, decimals = 2) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
    ) {
        return "--";
    }

    return Number(value).toLocaleString(
        undefined,
        {
            maximumFractionDigits: decimals
        }
    );
}


function average(values) {

    if (!values.length) return null;

    return values.reduce(
        (a, b) => a + b,
        0
    ) / values.length;
}


function sma(values, period) {

    if (values.length < period)
        return null;

    return average(
        values.slice(-period)
    );
}


function ema(values, period) {

    if (values.length < period)
        return null;

    const multiplier =
        2 / (period + 1);

    let result =
        average(values.slice(0, period));

    for (
        let i = period;
        i < values.length;
        i++
    ) {

        result =
            (
                values[i] - result
            ) * multiplier + result;

    }

    return result;
}


/* =========================================================
   RSI
========================================================= */

function calculateRSI(values, period = 14) {

    if (values.length <= period)
        return null;

    let gain = 0;
    let loss = 0;

    for (
        let i = values.length - period;
        i < values.length;
        i++
    ) {

        const change =
            values[i] - values[i - 1];

        if (change >= 0)
            gain += change;
        else
            loss += Math.abs(change);

    }

    if (loss === 0)
        return 100;

    const rs =
        (gain / period) /
        (loss / period);

    return 100 - (100 / (1 + rs));
}


/* =========================================================
   ATR
========================================================= */

function calculateATR(data, period = 14) {

    if (data.length <= period)
        return null;

    const trs = [];

    for (
        let i = data.length - period;
        i < data.length;
        i++
    ) {

        const current = data[i];
        const previous = data[i - 1];

        const tr = Math.max(
            current.high - current.low,
            Math.abs(
                current.high - previous.close
            ),
            Math.abs(
                current.low - previous.close
            )
        );

        trs.push(tr);
    }

    return average(trs);
}


/* =========================================================
   VWAP
========================================================= */

function calculateVWAP(data) {

    let totalPV = 0;
    let totalVolume = 0;

    data.slice(-100).forEach(candle => {

        const typical =
            (
                candle.high +
                candle.low +
                candle.close
            ) / 3;

        totalPV +=
            typical * candle.volume;

        totalVolume +=
            candle.volume;

    });

    if (!totalVolume)
        return null;

    return totalPV / totalVolume;
}


/* =========================================================
   MACD
========================================================= */

function calculateMACD(values) {

    const fast =
        ema(values, 12);

    const slow =
        ema(values, 26);

    if (
        fast === null ||
        slow === null
    ) {
        return null;
    }

    return fast - slow;
}


/* =========================================================
   MARKET DATA
========================================================= */

async function loadMarketData() {

    if (
        !state.symbol ||
        !state.interval
    ) {
        return;
    }

    setStatus(
        "● LOADING",
        "#ffc857"
    );

    try {

        const url =
            `${API_BASE}?symbol=${state.symbol}` +
            `&interval=${state.interval}` +
            `&limit=500`;

        const response =
            await fetch(url);

        if (!response.ok)
            throw new Error(
                "Market data request failed"
            );

        const raw =
            await response.json();

        state.candles =
            raw.map(item => ({

                time: Number(item[0]),

                open: Number(item[1]),

                high: Number(item[2]),

                low: Number(item[3]),

                close: Number(item[4]),

                volume: Number(item[5])

            }));

        setStatus(
            "● LIVE DATA",
            "#38e89a"
        );

        analyzeMarket();

    }
    catch (error) {

        console.error(error);

        setStatus(
            "● DATA ERROR",
            "#ff5964"
        );

    }
}


/* =========================================================
   STATUS
========================================================= */

function setStatus(text, color) {

    const element =
        $("connectionStatus");

    if (!element)
        return;

    element.textContent = text;
    element.style.color = color;
}


/* =========================================================
   INDICATORS
========================================================= */

function calculateIndicators() {

    const data =
        state.candles;

    if (data.length < 50)
        return null;

    const closes =
        data.map(c => c.close);

    const result = {

        ma7: sma(closes, 7),

        ma21: sma(closes, 21),

        ma50: sma(closes, 50),

        ma99: sma(closes, 99),

        ma200: sma(closes, 200),

        ema20: ema(closes, 20),

        ema50: ema(closes, 50),

        ema200: ema(closes, 200),

        rsi: calculateRSI(closes),

        atr: calculateATR(data),

        vwap: calculateVWAP(data),

        macd: calculateMACD(closes)

    };

    const recentVolumes =
        data.slice(-20)
            .map(c => c.volume);

    const averageVolume =
        average(recentVolumes);

    const currentVolume =
        data[data.length - 1].volume;

    result.relativeVolume =
        averageVolume
            ? currentVolume / averageVolume
            : null;

    return result;
}


/* =========================================================
   MARKET STRUCTURE
========================================================= */

function detectStructure() {

    const data =
        state.candles;

    if (data.length < 30)
        return {};

    const recent =
        data.slice(-30);

    const last =
        recent[recent.length - 1];

    const previous =
        recent[recent.length - 2];

    const earlier =
        recent.slice(0, -2);

    const previousHigh =
        Math.max(
            ...earlier.map(c => c.high)
        );

    const previousLow =
        Math.min(
            ...earlier.map(c => c.low)
        );

    let bos = "NONE";
    let choch = "NONE";

    if (last.close > previousHigh)
        bos = "BULLISH BOS";

    if (last.close < previousLow)
        bos
