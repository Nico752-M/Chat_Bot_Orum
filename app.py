import os, sqlite3, requests
from datetime import datetime
from flask import Flask, request

app = Flask(__name__)

VERIFY_TOKEN = os.environ["VERIFY_TOKEN"]
WA_TOKEN = os.environ["WA_TOKEN"]
PHONE_ID = os.environ["PHONE_ID"]
ANTHROPIC_KEY = os.environ["ANTHROPIC_API_KEY"]
OWNER = os.environ["OWNER_NUMBER"]          # numero del dueno, ej. 573001234567
TOPE = int(os.environ.get("TOPE", 600))
MODEL = "claude-haiku-5-5"
DB = "bot.db"

REGLAS = """Eres el asistente de WhatsApp de un negocio. Responde corto, claro y amable, en espanol.
Usa SOLO la informacion del negocio de abajo. Nunca inventes precios, productos ni datos.
Si te falta informacion o el cliente pide hablar con una persona, responde empezando con [TRASPASO]
seguido de un mensaje corto avisando que una persona le respondera pronto.

INFORMACION DEL NEGOCIO:
"""
NEGOCIO = open("negocio.txt", encoding="utf-8").read()


def db():
    c = sqlite3.connect(DB)
    c.executescript("""
    CREATE TABLE IF NOT EXISTS msgs(id INTEGER PRIMARY KEY, phone TEXT, role TEXT, content TEXT, ts TEXT);
    CREATE TABLE IF NOT EXISTS seen(id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS convs(day TEXT, phone TEXT, PRIMARY KEY(day, phone));
    CREATE TABLE IF NOT EXISTS tokens(ts TEXT, entrada INT, salida INT, cache INT);
    """)
    return c


def enviar(to, texto):
    requests.post(
        f"https://graph.facebook.com/v21.0/{PHONE_ID}/messages",
        headers={"Authorization": f"Bearer {WA_TOKEN}"},
        json={"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": texto}},
        timeout=20,
    )


def contar_conversacion(c, phone):
    hoy = datetime.now().strftime("%Y-%m-%d")
    mes = hoy[:7]
    c.execute("INSERT OR IGNORE INTO convs VALUES(?,?)", (hoy, phone))
    c.commit()
    n = c.execute("SELECT COUNT(*) FROM convs WHERE day LIKE ?", (mes + "%",)).fetchone()[0]
    if n == int(TOPE * 0.8):
        enviar(OWNER, f"Aviso: llevas {n} de {TOPE} conversaciones este mes (80%).")


def responder_ia(c, phone):
    filas = c.execute("SELECT role, content FROM msgs WHERE phone=? ORDER BY id DESC LIMIT 10", (phone,)).fetchall()[::-1]
    while filas and filas[0][0] != "user":
        filas.pop(0)
    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01"},
        json={
            "model": MODEL,
            "max_tokens": 400,
            "system": [{"type": "text", "text": REGLAS + NEGOCIO, "cache_control": {"type": "ephemeral"}}],
            "messages": [{"role": ro, "content": co} for ro, co in filas],
        },
        timeout=40,
    ).json()
    u = r.get("usage", {})
    c.execute("INSERT INTO tokens VALUES(?,?,?,?)", (datetime.now().isoformat(), u.get("input_tokens", 0),
              u.get("output_tokens", 0), u.get("cache_read_input_tokens", 0)))
    return "".join(b.get("text", "") for b in r.get("content", [])).strip()


@app.get("/webhook")
def verificar():
    if request.args.get("hub.verify_token") == VERIFY_TOKEN:
        return request.args.get("hub.challenge", ""), 200
    return "token incorrecto", 403


@app.post("/webhook")
def recibir():
    data = request.get_json(silent=True) or {}
    try:
        value = data["entry"][0]["changes"][0]["value"]
        msg = value["messages"][0]
    except (KeyError, IndexError):
        return "ok", 200  # estados de entrega, etc.

    c = db()
    if c.execute("SELECT 1 FROM seen WHERE id=?", (msg["id"],)).fetchone():
        return "ok", 200  # Meta reintenta: no responder dos veces
    c.execute("INSERT INTO seen VALUES(?)", (msg["id"],))

    phone = msg["from"]
    contar_conversacion(c, phone)

    if msg.get("type") != "text":
        enviar(phone, "Por ahora solo puedo leer mensajes de texto. Escribeme tu pregunta, por favor.")
        c.commit()
        return "ok", 200

    texto = msg["text"]["body"]
    c.execute("INSERT INTO msgs(phone, role, content, ts) VALUES(?,?,?,?)", (phone, "user", texto, datetime.now().isoformat()))
    try:
        resp = responder_ia(c, phone)
    except Exception:
        resp = "[TRASPASO] Tuvimos un problema tecnico. Una persona te respondera pronto."

    if resp.startswith("[TRASPASO]"):
        resp = resp.replace("[TRASPASO]", "", 1).strip()
        enviar(OWNER, f"Un cliente necesita a una persona: +{phone}\nPregunta: {texto}")

    c.execute("INSERT INTO msgs(phone, role, content, ts) VALUES(?,?,?,?)", (phone, "assistant", resp, datetime.now().isoformat()))
    c.commit()
    enviar(phone, resp)
    return "ok", 200


if __name__ == "__main__":
    app.run(port=int(os.environ.get("PORT", 5000)))
