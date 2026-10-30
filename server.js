// Backend local FecapStudy — porta 5080, mesmas rotas do BackendEstudoAPI.exe.
// Persistência: dados_estudo_local.json (fallback JSON). Rode: node server.js
const http = require("http"), fs = require("fs"), path = require("path");
const ARQ = path.join(__dirname, "dados_estudo_local.json");
const db = fs.existsSync(ARQ) ? JSON.parse(fs.readFileSync(ARQ, "utf8"))
  : { disciplinas: [], usuarios: [], metas_estudo: [], sessoes_estudo: [] };
const salvar = () => fs.writeFileSync(ARQ, JSON.stringify(db, null, 2));
const hora = () => new Date().toLocaleTimeString("pt-BR");
const log = (m) => console.log(`\x1b[32m[${hora()}] ${m}\x1b[0m`);

function responder(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS" });
  res.end(JSON.stringify(obj));
}
const corpo = (req) => new Promise((ok, erro) => {
  let b = ""; req.on("data", (c) => (b += c));
  req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { erro(e); } });
});
function meta(nome) {
  let m = db.metas_estudo.find((x) => x.discenteNome === nome);
  if (!m) db.metas_estudo.push((m = { discenteNome: nome, responsavelNome: "", metaMinutosSemana: 200, minutosCumpridos: 0 }));
  return m;
}

http.createServer(async (req, res) => {
  const url = decodeURI(req.url.split("?")[0]);
  if (req.method === "OPTIONS") return responder(res, 204, {});
  try {
    if (url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<h2>FecapStudy Backend — online ✅</h2><p>Armazenamento: JSON local (${ARQ})</p>
        <ul>${["status","disciplinas","usuarios","sessoes","metas"].map((r) => `<li><a href="/api/${r}">/api/${r}</a></li>`).join("")}</ul>`);
    }
    if (url === "/api/status" && req.method === "GET")
      return responder(res, 200, { online: true, armazenamento: "json-local", mysql: false,
        totais: { disciplinas: db.disciplinas.length, usuarios: db.usuarios.length, sessoes: db.sessoes_estudo.length, metas: db.metas_estudo.length } });
    if (url === "/api/disciplinas") {
      if (req.method === "POST") { const d = await corpo(req); db.disciplinas.push(d); salvar(); log(`POST /api/disciplinas -> ${d.nome}`); return responder(res, 201, d); }
      return responder(res, 200, db.disciplinas);
    }
    if (url === "/api/usuarios") {
      if (req.method === "POST") { const u = await corpo(req); db.usuarios.push(u); salvar(); log(`POST /api/usuarios -> ${u.nome} (${u.tipoPerfil})`); return responder(res, 201, u); }
      return responder(res, 200, db.usuarios);
    }
    if (url === "/api/sessoes") {
      if (req.method === "POST") {
        const s = await corpo(req);
        if (!s.discenteNome || !(s.duracaoMinutos > 0)) return responder(res, 400, { erro: "discenteNome e duracaoMinutos são obrigatórios" });
        db.sessoes_estudo.push(s); meta(s.discenteNome).minutosCumpridos += s.duracaoMinutos; salvar();
        log(`POST /api/sessoes -> ${s.discenteNome} estudou ${s.disciplina} (${s.tipoModalidade}, ${s.duracaoMinutos} min) -> +${s.xpGanho} XP!`);
        return responder(res, 201, s);
      }
      return responder(res, 200, db.sessoes_estudo);
    }
    if (url === "/api/metas") {
      if (req.method === "POST") {
        const d = await corpo(req), m = meta(d.discenteNome);
        m.responsavelNome = d.responsavelNome; m.metaMinutosSemana = d.metaMinutosSemana; salvar();
        log(`POST /api/metas -> ${d.discenteNome}: ${d.metaMinutosSemana} min`); return responder(res, 200, m);
      }
      return responder(res, 200, db.metas_estudo);
    }
    if (url.startsWith("/api/relatorio/")) {
      const nome = url.slice(15), sess = db.sessoes_estudo.filter((s) => s.discenteNome === nome);
      const m = db.metas_estudo.find((x) => x.discenteNome === nome);
      return responder(res, 200, { discente: nome, totalSessoes: sess.length,
        totalMinutos: sess.reduce((a, s) => a + s.duracaoMinutos, 0), totalXp: sess.reduce((a, s) => a + (s.xpGanho || 0), 0),
        meta: m || null, percentualMeta: m ? Math.min(100, +(m.minutosCumpridos / m.metaMinutosSemana * 100).toFixed(1)) : 0, sessoes: sess });
    }
    responder(res, 404, { erro: "rota não encontrada" });
  } catch (e) { responder(res, 400, { erro: e.message }); }
}).listen(5080, "localhost", () => log("Servidor escutando em http://localhost:5080"));
