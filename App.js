// NiftyAI Pro — Multi-User Android App
// React Native (Expo) — Save as App.js
// Install: npx create-expo-app NiftyAIApp && replace App.js

import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, StatusBar, ActivityIndicator,
  RefreshControl, Alert, Animated, AppState
} from "react-native";

// Line 1 change karo:
const SERVER = "http://92.4.91.185:8080";


// ── Color tokens ─────────────────────────────────────────────────
const C = {
  bg:      "#070d0a",
  card:    "#0d1a12",
  border:  "#1a3d25",
  green:   "#00e676",
  red:     "#ff5252",
  yellow:  "#ffca28",
  cyan:    "#00e5ff",
  gray:    "#546e7a",
  white:   "#eceff1",
  dimtext: "#78909c",
};

// ── Login Screen ──────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [clientId,  setClientId]  = useState("");
  const [token,     setToken]     = useState("");
  const [mode,      setMode]      = useState("LIVE");
  const [tp,        setTp]        = useState("10");
  const [sl,        setSl]        = useState("7");
  const [loading,   setLoading]   = useState(false);

  const handleStart = async () => {
    if (mode === "LIVE" && (!clientId || !token)) {
      Alert.alert("Required", "Client ID and Access Token are required for LIVE mode.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${SERVER}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id:    clientId.trim(),
          access_token: token.trim(),
          mode,
          tp_pct:       parseFloat(tp) || 10,
          sl_pct:       parseFloat(sl) || 7,
          max_hold_min: 45,
        }),
      });
      const data = await res.json();
      if (data.client_id) {
        onLogin(data.client_id);
      } else {
        Alert.alert("Error", JSON.stringify(data));
      }
    } catch (e) {
      Alert.alert("Connection Failed", `Cannot reach ${SERVER}\n${e.message}`);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.loginScroll}>
        <Text style={s.logo}>⚡ NiftyAI Pro</Text>
        <Text style={s.logoSub}>Algorithmic Options Trading</Text>

        {mode === "LIVE" && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>DHAN CREDENTIALS</Text>
            <Text style={s.label}>Client ID</Text>
            <TextInput
              style={s.input} value={clientId} onChangeText={setClientId}
              placeholder="e.g. 1110820934" placeholderTextColor={C.gray}
              keyboardType="numeric" autoCapitalize="none"
            />
            <Text style={s.label}>Access Token</Text>
            <TextInput
              style={[s.input, {height: 70}]} value={token} onChangeText={setToken}
              placeholder="Paste your Dhan API token" placeholderTextColor={C.gray}
              multiline autoCapitalize="none" secureTextEntry
            />
          </View>
        )}

        {mode === "DEMO" && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>DEMO MODE</Text>
            <Text style={{color: C.dimtext, fontSize: 12, lineHeight: 18}}>
              Demo mode simulated prices ke saath chalta hai — koi Dhan login ki zaroorat nahi. Bas START BOT dabao.
            </Text>
          </View>
        )}

        <View style={s.card}>
          <Text style={s.sectionTitle}>TRADE SETTINGS</Text>

          <View style={s.row}>
            <View style={{flex:1, marginRight:8}}>
              <Text style={s.label}>TP %</Text>
              <TextInput style={s.input} value={tp} onChangeText={setTp}
                keyboardType="decimal-pad" placeholderTextColor={C.gray}/>
            </View>
            <View style={{flex:1}}>
              <Text style={s.label}>SL %</Text>
              <TextInput style={s.input} value={sl} onChangeText={setSl}
                keyboardType="decimal-pad" placeholderTextColor={C.gray}/>
            </View>
          </View>
          <Text style={s.label}>Mode</Text>
          <View style={s.row}>
            {["LIVE","DEMO"].map(m => (
              <TouchableOpacity key={m} onPress={()=>setMode(m)}
                style={[s.modeBtn, mode===m && s.modeBtnActive]}>
                <Text style={[s.modeTxt, mode===m && {color: m==="LIVE"?C.green:C.yellow}]}>
                  {m==="LIVE" ? "🔴 LIVE" : "🟡 DEMO"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={s.startBtn} onPress={handleStart} disabled={loading}>
          {loading
            ? <ActivityIndicator color={C.bg}/>
            : <Text style={s.startTxt}>START BOT</Text>}
        </TouchableOpacity>

        <Text style={s.serverNote}>Server: {SERVER}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Dashboard Screen ──────────────────────────────────────────────
function DashboardScreen({ clientId, onLogout }) {
  const [data,      setData]      = useState(null);
  const [logs,      setLogs]      = useState([]);
  const [connected, setConnected] = useState(false);
  const [refresh,   setRefresh]   = useState(false);
  const ws = useRef(null);
  const pulse = useRef(new Animated.Value(1)).current;

  // Pulse animation for live indicator
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 0.3, duration: 800, useNativeDriver:true}),
        Animated.timing(pulse, {toValue: 1.0, duration: 800, useNativeDriver:true}),
      ])
    ).start();
  }, []);

  // WebSocket connection — v2 FIX: auto-reconnect with backoff + reconnect on app foreground.
  // Previously: onclose only set connected=false and never retried, so once Android
  // killed the socket (screen lock / app minimized / Doze), the app stayed OFFLINE
  // forever even after you reopened it, until a manual logout+login.
  const reconnectTimer = useRef(null);
  const retryCount     = useRef(0);
  const closedByUs     = useRef(false);

  const connectWs = useCallback(() => {
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
    closedByUs.current = false;

    const wsUrl = SERVER.replace("http", "ws") + `/ws/${clientId}`;
    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      retryCount.current = 0;   // reset backoff on a healthy connect
      fetchLogs();              // catch up on anything missed while disconnected
    };
    socket.onmessage = (e) => {
      try { setData(JSON.parse(e.data)); } catch {}
    };
    const scheduleReconnect = () => {
      setConnected(false);
      if (closedByUs.current) return;   // we closed it on purpose (logout/unmount)
      const delay = Math.min(1000 * 2 ** retryCount.current, 15000);  // 1s,2s,4s...capped 15s
      retryCount.current += 1;
      reconnectTimer.current = setTimeout(connectWs, delay);
    };
    socket.onclose = scheduleReconnect;
    socket.onerror = scheduleReconnect;
  }, [clientId]);

  useEffect(() => {
    connectWs();
    return () => {
      closedByUs.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connectWs]);

  // Reconnect immediately when the app comes back to foreground (unlock / restore
  // from minimized) instead of waiting for the next backoff tick.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        const s = ws.current;
        if (!s || s.readyState === WebSocket.CLOSED || s.readyState === WebSocket.CLOSING) {
          retryCount.current = 0;
          connectWs();
        }
      }
    });
    return () => sub.remove();
  }, [connectWs]);

  // Fetch logs every 10s
  const fetchLogs = useCallback(async () => {
    try {
      const r = await fetch(`${SERVER}/logs/${clientId}?n=30`);
      const d = await r.json();
      setLogs((d.logs || []).reverse());
    } catch {}
  }, [clientId]);

  useEffect(() => {
    fetchLogs();
    const t = setInterval(fetchLogs, 10000);
    return () => clearInterval(t);
  }, [fetchLogs]);

  const onRefresh = async () => { setRefresh(true); await fetchLogs(); setRefresh(false); };

  const st  = data?.state || {};
  const pos = data?.positions || [];
  const bal = data?.balance  || {};

  const sig     = st.signal || "NEUTRAL";
  const sigCol  = sig==="BULLISH" ? C.green : sig==="BEARISH" ? C.red : C.yellow;
  const pnl     = data?.day_pnl || 0;
  const pnlCol  = pnl >= 0 ? C.green : C.red;

  const logColor = (l) => {
    if (l.includes("ERROR") || l.includes("FAIL"))   return C.red;
    if (l.includes("WARN"))                           return C.yellow;
    if (l.includes("TRADE ENTERED"))                  return C.cyan;
    if (l.includes("TRADE EXITED"))                   return C.yellow;
    if (l.includes("PREDICT"))                        return "#ce93d8";
    return C.dimtext;
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <ScrollView refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh}/>}>

        {/* Header */}
        <View style={[s.card, {flexDirection:"row", justifyContent:"space-between", alignItems:"center"}]}>
          <View>
            <Text style={s.headerTitle}>⚡ NiftyAI Pro</Text>
            <Text style={s.dimTxt}>{clientId}</Text>
          </View>
          <View style={{alignItems:"flex-end"}}>
            <View style={{flexDirection:"row", alignItems:"center"}}>
              <Animated.View style={{width:8,height:8,borderRadius:4,
                backgroundColor: connected?C.green:C.red, opacity:pulse, marginRight:4}}/>
              <Text style={{color: connected?C.green:C.red, fontSize:11}}>
                {connected?"LIVE":"OFFLINE"}
              </Text>
            </View>
            <TouchableOpacity onPress={onLogout}>
              <Text style={{color:C.gray, fontSize:11, marginTop:4}}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Nifty + Signal */}
        <View style={s.card}>
          <View style={s.row}>
            <View>
              <Text style={s.dimTxt}>NIFTY {st.expiry||""}</Text>
              <Text style={[s.bigNum, {color: C.white}]}>
                ₹{st.nifty_price?.toLocaleString("en-IN") || "--"}
              </Text>
            </View>
            <View style={{alignItems:"flex-end"}}>
              <View style={[s.sigBadge, {borderColor: sigCol}]}>
                <Text style={[s.sigTxt, {color: sigCol}]}>{sig}</Text>
                <Text style={[s.sigTxt, {color: sigCol, fontSize:10}]}> {st.conf||""}</Text>
              </View>
              <Text style={[s.dimTxt, {marginTop:4}]}>VIX: {st.india_vix||"--"}</Text>
            </View>
          </View>
          <View style={[s.row, {marginTop:8}]}>
            <Text style={s.dimTxt}>RSI: {st.rsi?.toFixed(1)||"--"}</Text>
            <Text style={s.dimTxt}>ATR: {st.atr?.toFixed(1)||"--"}</Text>
            <Text style={s.dimTxt}>BW: {st.bb_bw||"--"}%</Text>
            <Text style={s.dimTxt}>Candle: {st.candle_count||0}/60</Text>
          </View>
        </View>

        {/* P&L + Balance */}
        <View style={s.card}>
          <View style={s.row}>
            <View style={{flex:1}}>
              <Text style={s.dimTxt}>DAY P&L</Text>
              <Text style={[s.bigNum, {color: pnlCol}]}>
                ₹{pnl >= 0 ? "+" : ""}{pnl}
              </Text>
            </View>
            <View style={{flex:1, alignItems:"center"}}>
              <Text style={s.dimTxt}>BALANCE</Text>
              <Text style={[s.bigNum, {color: C.white}]}>
                ₹{bal.total?.toLocaleString("en-IN") || "--"}
              </Text>
            </View>
            <View style={{flex:1, alignItems:"flex-end"}}>
              <Text style={s.dimTxt}>TRADES</Text>
              <Text style={[s.bigNum, {color: C.cyan}]}>{data?.trades||0}/10</Text>
            </View>
          </View>
        </View>

        {/* Active Position */}
        {pos.length > 0 && pos.map((p, i) => (
          <View key={i} style={[s.card, {borderColor: C.cyan, borderWidth:1}]}>
            <Text style={{color:C.cyan, fontSize:11, marginBottom:4}}>● ACTIVE POSITION</Text>
            <View style={s.row}>
              <Text style={{color:C.white, fontWeight:"bold"}}>{p.symbol||"--"}</Text>
              <Text style={{color: (p.pnl||0)>=0?C.green:C.red, fontWeight:"bold"}}>
                ₹{p.pnl||0}
              </Text>
            </View>
            <View style={s.row}>
              <Text style={s.dimTxt}>Entry: ₹{p.entry_price||0}</Text>
              <Text style={s.dimTxt}>LTP: ₹{p.ltp||0}</Text>
            </View>
          </View>
        ))}

        {/* Scanner */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>TOP 25 SCANNER</Text>
          <View style={s.row}>
            <Text style={{color:C.green}}>▲ Adv: {st.advancers||0}</Text>
            <Text style={{color:C.dimtext}}>Score: {st.scan_score?.toFixed(3)||"0.000"}</Text>
            <Text style={{color:C.red}}>▼ Dec: {st.decliners||0}</Text>
          </View>
          <Text style={[s.dimTxt,{marginTop:4}]}>
            MTF: 5m:{st.mtf_5m||"?"} 15m:{st.mtf_15m||"?"} 30m:{st.mtf_30m||"?"}
          </Text>
        </View>

        {/* VWAP + ADX */}
        <View style={s.card}>
          <View style={s.row}>
            <View>
              <Text style={s.dimTxt}>VWAP</Text>
              <Text style={{color:C.white}}>₹{st.vwap?.toFixed(0)||"--"}</Text>
            </View>
            <View style={{alignItems:"center"}}>
              <Text style={s.dimTxt}>ADX</Text>
              <Text style={{color: (st.adx||0)>=20?C.green:C.yellow}}>
                {st.adx?.toFixed(0)||"--"} {(st.adx||0)>=20?"TREND":"CHOP"}
              </Text>
            </View>
            <View style={{alignItems:"flex-end"}}>
              <Text style={s.dimTxt}>STRUCTURE</Text>
              <Text style={{color: (st.market_structure||"").includes("UP")?C.green:
                                   (st.market_structure||"").includes("DOWN")?C.red:C.yellow}}>
                {st.market_structure||"--"}
              </Text>
            </View>
          </View>
        </View>

        {/* Today Log */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>TODAY LOG</Text>
          {logs.slice(0, 20).map((line, i) => (
            <Text key={i} style={[s.logLine, {color: logColor(line)}]}
              numberOfLines={2}>{line.trim()}</Text>
          ))}
          {logs.length === 0 &&
            <Text style={s.dimTxt}>No logs yet...</Text>}
        </View>

        <View style={{height: 20}}/>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Main App ──────────────────────────────────────────────────────
export default function App() {
  const [clientId, setClientId] = useState(null);

  if (!clientId) {
    return <LoginScreen onLogin={setClientId}/>;
  }
  return <DashboardScreen clientId={clientId} onLogout={() => setClientId(null)}/>;
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:         { flex:1, backgroundColor: C.bg },
  loginScroll:  { padding:16, paddingBottom:40 },
  logo:         { fontSize:32, color:C.green, fontWeight:"bold", textAlign:"center", marginTop:24 },
  logoSub:      { fontSize:13, color:C.dimtext, textAlign:"center", marginBottom:24 },
  card:         { backgroundColor:C.card, borderRadius:10, padding:14,
                  marginBottom:10, borderWidth:1, borderColor:C.border },
  sectionTitle: { color:C.dimtext, fontSize:10, letterSpacing:1.5,
                  fontWeight:"bold", marginBottom:10 },
  label:        { color:C.dimtext, fontSize:11, marginBottom:4, marginTop:8 },
  input:        { backgroundColor:"#0a150f", borderRadius:6, borderWidth:1,
                  borderColor:C.border, color:C.white, padding:10,
                  fontSize:13, fontFamily:"monospace" },
  row:          { flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  modeBtn:      { flex:1, padding:10, borderRadius:6, borderWidth:1, borderColor:C.border,
                  marginHorizontal:4, alignItems:"center" },
  modeBtnActive:{ borderColor:C.green, backgroundColor:"#0d2a18" },
  modeTxt:      { color:C.gray, fontWeight:"bold" },
  startBtn:     { backgroundColor:C.green, borderRadius:10, padding:16,
                  alignItems:"center", marginTop:8 },
  startTxt:     { color:C.bg, fontWeight:"bold", fontSize:16, letterSpacing:1 },
  serverNote:   { color:C.gray, fontSize:10, textAlign:"center", marginTop:12 },
  headerTitle:  { color:C.green, fontSize:18, fontWeight:"bold" },
  dimTxt:       { color:C.dimtext, fontSize:11 },
  bigNum:       { fontSize:22, fontWeight:"bold", fontFamily:"monospace" },
  sigBadge:     { borderWidth:1, borderRadius:6, paddingHorizontal:10,
                  paddingVertical:4, flexDirection:"row" },
  sigTxt:       { fontWeight:"bold", fontSize:13 },
  logLine:      { fontSize:10, fontFamily:"monospace", marginBottom:2, lineHeight:15 },
});
