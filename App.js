// ── REPLACE your existing LoginScreen function in App.js with this one ──
// Everything else in your file (DashboardScreen, styles, App, SERVER, C) stays the same.
// This only adds a broker selector above the DHAN CREDENTIALS card.

const BROKERS = [
  { key: "DHAN",     label: "Dhan" },
  { key: "UPSTOX",   label: "Upstox" },
  { key: "FYERS",    label: "FYERS" },
  { key: "SHOONYA",  label: "Shoonya" },
  { key: "ANGELONE", label: "Angel One" },
  { key: "ZERODHA",  label: "Zerodha" },
];

function LoginScreen({ onLogin }) {
  const [clientId,  setClientId]  = useState("");
  const [token,     setToken]     = useState("");
  const [mode,      setMode]      = useState("LIVE");
  const [broker,    setBroker]    = useState("DHAN");
  const [tp,        setTp]        = useState("10");
  const [sl,        setSl]        = useState("7");
  const [loading,   setLoading]   = useState(false);

  const showComingSoon = (brokerLabel) => {
    Alert.alert(
      "🚀 Coming Soon",
      `${brokerLabel} support is on the way!\n\nTry DEMO mode right now to see NiftyAI Pro in action — no broker account needed. For LIVE trading today, connect with Dhan.`,
      [
        { text: "Try Demo", onPress: () => { setMode("DEMO"); setBroker("DHAN"); } },
        { text: "Use Dhan Instead", onPress: () => setBroker("DHAN") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleBrokerSelect = (b) => {
    if (b.key !== "DHAN") {
      showComingSoon(b.label);
      return;   // don't switch the selection — keep whatever was active before
    }
    setBroker("DHAN");
  };

  const handleStart = async () => {
    if (mode === "LIVE" && broker !== "DHAN") {
      showComingSoon(BROKERS.find(b => b.key === broker)?.label || broker);
      return;
    }
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
            <Text style={s.sectionTitle}>SELECT BROKER</Text>
            <View style={s.brokerGrid}>
              {BROKERS.map((b) => (
                <TouchableOpacity
                  key={b.key}
                  onPress={() => handleBrokerSelect(b)}
                  style={[s.brokerChip, broker === b.key && s.brokerChipActive]}
                >
                  <Text style={[s.brokerTxt, broker === b.key && { color: C.green }]}>
                    {b.label}
                  </Text>
                  {b.key !== "DHAN" && (
                    <Text style={s.comingSoonTag}>Soon</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {mode === "LIVE" && broker === "DHAN" && (
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

        {mode === "LIVE" && broker !== "DHAN" && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>
              {BROKERS.find(b => b.key === broker)?.label.toUpperCase()} — COMING SOON
            </Text>
            <Text style={{color: C.dimtext, fontSize: 12, lineHeight: 18}}>
              We're working on adding this broker. Try DEMO mode below to explore the bot right now,
              or switch to Dhan above for LIVE trading today.
            </Text>
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

// ── ADD these two new style entries into your existing `s = StyleSheet.create({...})` ──
// (keep every existing style you already have — just add these two)
//
//   brokerGrid:      { flexDirection:"row", flexWrap:"wrap", marginTop:4 },
//   brokerChip:      { paddingVertical:8, paddingHorizontal:12, borderRadius:6,
//                       borderWidth:1, borderColor:C.border, marginRight:8, marginBottom:8,
//                       flexDirection:"row", alignItems:"center" },
//   brokerChipActive:{ borderColor:C.green, backgroundColor:"#0d2a18" },
//   brokerTxt:       { color:C.gray, fontWeight:"bold", fontSize:12 },
//   comingSoonTag:   { color:C.yellow, fontSize:8, marginLeft:5, fontWeight:"bold" },
