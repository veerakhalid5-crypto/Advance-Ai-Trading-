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
        bos = "BEARISH BOS";

    if (
        previous.low < previousLow &&
        last.close > previousLow
    ) {
        choch =
            "BULLISH CHoCH";
    }

    if (
        previous.high > previousHigh &&
        last.close < previousHigh
    ) {
        choch =
            "BEARISH CHoCH";
    }

    return {
        bos,
        choch,
        previousHigh,
        previousLow
    };
}


/* =========================================================
   LIQUIDITY
========================================================= */

function detectLiquidity() {

    const data =
        state.candles;

    if (data.length < 20)
        return "ANALYZING";

    const recent =
        data.slice(-20);

    const last =
        recent[recent.length - 1];

    const highs =
        recent.map(c => c.high);

    const lows =
        recent.map(c => c.low);

    const high =
        Math.max(...highs);

    const low =
        Math.min(...lows);

    if (
        last.high >= high &&
        last.close < high
    ) {
        return "BUY-SIDE SWEEP";
    }

    if (
        last.low <= low &&
        last.close > low
    ) {
        return "SELL-SIDE SWEEP";
    }

    return "LIQUIDITY DEVELOPING";
}


/* =========================================================
   FAIR VALUE GAP
========================================================= */

function detectFVG() {

    const data =
        state.candles;

    if (data.length < 5)
        return null;

    const a =
        data[data.length - 3];

    const b =
        data[data.length - 2];

    const c =
        data[data.length - 1];

    if (c.low > a.high) {

        return {
            type: "BULLISH FVG",
            low: a.high,
            high: c.low
        };

    }

    if (c.high < a.low) {

        return {
            type: "BEARISH FVG",
            low: c.high,
            high: a.low
        };

    }

    return null;
}


/* =========================================================
   ORDER BLOCK
========================================================= */

function detectOrderBlock() {

    const data =
        state.candles;

    if (data.length < 10)
        return "WAITING";

    const last =
        data[data.length - 1];

    const previous =
        data[data.length - 2];

    if (
        previous.close <
        previous.open &&
        last.close >
        previous.high
    ) {

        return "BULLISH ORDER BLOCK";

    }

    if (
        previous.close >
        previous.open &&
        last.close <
        previous.low
    ) {

        return "BEARISH ORDER BLOCK";

    }

    return "NO CONFIRMED OB";
}


/* =========================================================
   PREMIUM / DISCOUNT
========================================================= */

function premiumDiscount() {

    const data =
        state.candles.slice(-50);

    if (!data.length)
        return "--";

    const high =
        Math.max(
            ...data.map(c => c.high)
        );

    const low =
        Math.min(
            ...data.map(c => c.low)
        );

    const midpoint =
        (high + low) / 2;

    const price =
        data[data.length - 1].close;

    return {
        zone:
            price >= midpoint
                ? "PREMIUM"
                : "DISCOUNT",

        high,
        low,
        midpoint
    };
}


/* =========================================================
   CRT
========================================================= */

function analyzeCRT() {

    const data =
        state.candles;

    if (data.length < 5)
        return {};

    const previous =
        data[data.length - 2];

    const current =
        data[data.length - 1];

    const midpoint =
        (
            previous.high +
            previous.low
        ) / 2;

    let stateText =
        "INSIDE RANGE";

    if (
        current.high >
        previous.high &&
        current.close >
        previous.high
    ) {

        stateText =
            "BULLISH EXPANSION";

    }

    else if (
        current.low <
        previous.low &&
        current.close <
        previous.low
    ) {

        stateText =
            "BEARISH EXPANSION";

    }

    else if (
        current.low <
        previous.low &&
        current.close >
        previous.low
    ) {

        stateText =
            "SELL-SIDE SWEEP + RECLAIM";

    }

    else if (
        current.high >
        previous.high &&
        current.close <
        previous.high
    ) {

        stateText =
            "BUY-SIDE SWEEP + REJECT";

    }

    return {
        range:
            previous.high -
            previous.low,

        midpoint,

        stateText
    };
}


/* =========================================================
   WYCKOFF
========================================================= */

function analyzeWyckoff() {

    const data =
        state.candles;

    if (data.length < 30)
        return "ANALYZING";

    const recent =
        data.slice(-20);

    const first =
        recent[0].close;

    const last =
        recent[recent.length - 1].close;

    const high =
        Math.max(
            ...recent.map(c => c.high)
        );

    const low =
        Math.min(
            ...recent.map(c => c.low)
        );

    const range =
        high - low;

    if (!range)
        return "RANGE";

    const position =
        (last - low) / range;

    if (
        position > 0.75 &&
        last > first
    ) {
        return "MARKUP / STRENGTH";
    }

    if (
        position < 0.25 &&
        last < first
    ) {
        return "MARKDOWN / WEAKNESS";
    }

    return "ACCUMULATION / DISTRIBUTION RANGE";
}


/* =========================================================
   SIGNAL ENGINE
========================================================= */

function generateSignal(indicators, structure) {

    if (!indicators)
        return null;

    const price =
        state.candles[
            state.candles.length - 1
        ].close;

    let score = 0;

    const reasons = [];

    if (
        indicators.ma7 &&
        indicators.ma21
    ) {

        if (
            indicators.ma7 >
            indicators.ma21
        ) {

            score += 1;
            reasons.push("MA 7 > MA 21");

        }
        else {

            score -= 1;
            reasons.push("MA 7 < MA 21");

        }

    }

    if (
        indicators.ema20 &&
        indicators.ema50
    ) {

        if (
            indicators.ema20 >
            indicators.ema50
        ) {

            score += 1;
            reasons.push("EMA 20 > EMA 50");

        }
        else {

            score -= 1;
            reasons.push("EMA 20 < EMA 50");

        }

    }

    if (
        indicators.rsi !== null
    ) {

        if (
            indicators.rsi > 55 &&
            indicators.rsi < 75
        ) {

            score += 1;
            reasons.push("RSI bullish");

        }

        else if (
            indicators.rsi < 45 &&
            indicators.rsi > 25
        ) {

            score -= 1;
            reasons.push("RSI bearish");

        }

    }

    if (
        structure.bos ===
        "BULLISH BOS"
    ) {

        score += 2;
        reasons.push("BULLISH BOS");

    }

    if (
        structure.bos ===
        "BEARISH BOS"
    ) {

        score -= 2;
        reasons.push("BEARISH BOS");

    }

    let signal =
        "NEUTRAL";

    if (score >= 3)
        signal = "LONG";

    if (score <= -3)
        signal = "SHORT";

    const atr =
        indicators.atr || price * 0.01;

    let entry = price;
    let sl;
    let tp1;
    let tp2;
    let tp3;

    if (signal === "LONG") {

        sl =
            price - atr * 1.2;

        tp1 =
            price + atr * 1.2;

        tp2 =
            price + atr * 2;

        tp3 =
            price + atr * 3;

    }

    else if (signal === "SHORT") {

        sl =
            price + atr * 1.2;

        tp1 =
            price - atr * 1.2;

        tp2 =
            price - atr * 2;

        tp3 =
            price - atr * 3;

    }

    else {

        sl =
            price - atr;

        tp1 =
            price + atr;

        tp2 =
            price + atr * 2;

        tp3 =
            price + atr * 3;

    }

    return {

        signal,

        score,

        confidence:
            Math.min(
                95,
                50 +
                Math.abs(score) * 8
            ),

        entry,
        sl,
        tp1,
        tp2,
        tp3,

        reasons

    };
}


/* =========================================================
   UI UPDATE
========================================================= */

function updateIndicatorsUI(ind) {

    if (!ind)
        return;

    if ($("maState")) {

        $("maState").textContent =
            ind.ma7 && ind.ma21
                ? ind.ma7 > ind.ma21
                    ? "BULLISH"
                    : "BEARISH"
                : "--";

    }

    if ($("emaState")) {

        $("emaState").textContent =
            ind.ema20 && ind.ema50
                ? ind.ema20 > ind.ema50
                    ? "BULLISH"
                    : "BEARISH"
                : "--";

    }

    if ($("rsi")) {

        $("rsi").textContent =
            formatNumber(ind.rsi, 1);

    }

    if ($("macd")) {

        $("macd").textContent =
            formatNumber(ind.macd, 5);

    }

    if ($("atr")) {

        $("atr").textContent =
            formatNumber(ind.atr);

    }

    if ($("vwap")) {

        $("vwap").textContent =
            formatNumber(ind.vwap);

    }

    if ($("relativeVolume")) {

        $("relativeVolume").textContent =
            ind.relativeVolume
                ? ind.relativeVolume.toFixed(2) + "x"
                : "--";

    }

    if ($("bollinger")) {

        $("bollinger").textContent =
            "ACTIVE";

    }

    if ($("volume")) {

        const current =
            state.candles[
                state.candles.length - 1
            ].volume;

        $("volume").textContent =
            formatNumber(current, 0);

    }

}


/* =========================================================
   STRUCTURE UI
========================================================= */

function updateStructureUI(structure) {

    const tags = [];

    if (
        structure.bos &&
        structure.bos !== "NONE"
    ) {

        tags.push(
            `<span class="tag ${
                structure.bos.includes("BULLISH")
                    ? "green"
                    : "red"
            }">${structure.bos}</span>`
        );

    }

    if (
        structure.choch &&
        structure.choch !== "NONE"
    ) {

        tags.push(
            `<span class="tag blue">${structure.choch}</span>`
        );

    }

    const liquidity =
        detectLiquidity();

    tags.push(
        `<span class="tag yellow">${liquidity}</span>`
    );

    const fvg =
        detectFVG();

    if (fvg) {

        tags.push(
            `<span class="tag blue">${fvg.type}</span>`
        );

    }

    tags.push(
        `<span class="tag">${detectOrderBlock()}</span>`
    );

    if ($("structureTags")) {

        $("structureTags").innerHTML =
            tags.join("");

    }

    if ($("bos")) {

        $("bos").textContent =
            structure.bos || "--";

    }

    if ($("liquidity")) {

        $("liquidity").textContent =
            liquidity;

    }

    if ($("fvg")) {

        $("fvg").textContent =
            fvg
                ? fvg.type
                : "NO CLEAR FVG";

    }

    if ($("orderBlock")) {

        $("orderBlock").textContent =
            detectOrderBlock();

    }

    const pd =
        premiumDiscount();

    if ($("premiumDiscount")) {

        $("premiumDiscount").textContent =
            pd.zone || "--";

    }

    if ($("previousRange")) {

        $("previousRange").textContent =
            pd.high
                ? `${formatNumber(pd.low)} — ${formatNumber(pd.high)}`
                : "--";

    }

}


/* =========================================================
   SIGNAL UI
========================================================= */

function updateSignalUI(signal) {

    if (!signal)
        return;

    const signalElement =
        $("signal");

    if (signalElement) {

        signalElement.textContent =
            signal.signal;

        signalElement.className =
            "signal-value " +
            (
                signal.signal === "LONG"
                    ? "long"
                    : signal.signal === "SHORT"
            
document.addEventListener("DOMContentLoaded", () => {

    setStatus(
        "● CONNECTING",
        "#ffc857"
    );

    loadMarketData();

    if (state.live) {

        state.timer = setInterval(() => {
            loadMarketData();
        }, 30000);

    }

});
