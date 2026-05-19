const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');
const bcrypt = require('bcrypt'); // Librería de seguridad añadida

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Función de seguridad para evitar XSS (Cross-Site Scripting)
const escapeHTML = (str) => {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])
    );
};

// --- PREPARACIÓN DE LA BASE DE DATOS ---
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error(err.message);
    else {
        console.log("Conectado a SQLite Seguro.");
        db.serialize(() => {
            db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, account_balance TEXT)");
            db.run("CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY, text TEXT)");
            // Simulamos contraseñas hasheadas para los usuarios iniciales
            const hashAdmin = bcrypt.hashSync('SuperSecreto123', 10);
            const hashRafa = bcrypt.hashSync('rafa_pwd', 10);
            db.run("INSERT OR IGNORE INTO users (id, username, password, account_balance) VALUES (1, 'admin', ?, '50000$'), (2, 'rafa', ?, '100$')", [hashAdmin, hashRafa]);
        });
    }
});

// Ruta de inicio
app.get('/', (req, res) => {
    res.send(`<h1>euVWA - Menú Seguro</h1>
              <ul>
                <li><a href="/v1/xss-r">1. XSS Reflejado (Securizado)</a></li>
                <li><a href="/v2/xss-s">2. XSS Almacenado (Securizado)</a></li>
                <li><a href="/v3/sqli">3. Inyección SQL (Securizado)</a></li>
                <li><a href="/v4/cmd">4. Command Injection (Securizado)</a></li>
                <li><a href="/v5/idor/2">5. IDOR (Securizado)</a></li>
                <li><a href="/v6/datos">6. Sensitive Data Exposure (Securizado)</a></li>
                <li><a href="/v7/error">7. Security Misconfiguration (Securizado)</a></li>
                <li><a href="/v8/auth">8. Broken Authentication (Securizado)</a></li>
              </ul>`);
});

// --- LAS 8 VULNERABILIDADES CORREGIDAS ---

// 1. XSS Reflejado (CORREGIDO: Sanitización de Input)
app.get('/v1/xss-r', (req, res) => {
    let nombre = req.query.nombre || 'Invitado';
    let nombreSeguro = escapeHTML(nombre); // Escapamos los caracteres maliciosos
    res.send(`<h1>Buscador Seguro</h1> <p>Resultados para: ${nombreSeguro}</p>`);
});

// 2. XSS Almacenado (CORREGIDO: Sanitización al leer de BD)
app.get('/v2/xss-s', (req, res) => {
    db.all("SELECT text FROM comments", [], (err, rows) => {
        let html = '<h1>Foro Seguro</h1><form method="POST"><input name="comentario"><button>Enviar</button></form><ul>';
        // Escapamos el texto antes de inyectarlo en el HTML
        rows.forEach(r => html += `<li>${escapeHTML(r.text)}</li>`); 
        html += '</ul>';
        res.send(html);
    });
});
app.post('/v2/xss-s', (req, res) => {
    // Usamos consultas parametrizadas para insertar
    db.run(`INSERT INTO comments (text) VALUES (?)`, [req.body.comentario]);
    res.redirect('/v2/xss-s');
});

// 3. Inyección SQL (CORREGIDO: Consultas Parametrizadas)
app.get('/v3/sqli', (req, res) => {
    let user = req.query.user || '';
    // Usamos '?' en lugar de concatenar el string directamente
    let query = "SELECT id, username FROM users WHERE username = ?";
    db.all(query, [user], (err, rows) => {
        res.send(`<h1>Login Seguro</h1><form><input name="user" placeholder="Usuario"><button>Buscar</button></form><p>Resultados: ${JSON.stringify(rows)}</p>`);
    });
});

// 4. Command Injection (CORREGIDO: Validación estricta con Regex)
app.get('/v4/cmd', (req, res) => {
    let ip = req.query.ip || '127.0.0.1';
    // Validamos que el input sea estrictamente una IP (números y puntos)
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    if (!ipRegex.test(ip)) {
        return res.send(`<h1>Herramienta Ping Segura</h1><p>Error: IP no válida. Intentos de inyección bloqueados.</p>`);
    }

    // Le decimos a Semgrep que ignore esta línea porque ya mitigamos el riesgo con la Regex superior (Falso Positivo)
    // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
    exec('ping -n 1 ' + ip, (err, stdout) => {
        res.send(`<h1>Herramienta Ping Segura</h1><form><input name="ip" value="${ip}"><button>Ping</button></form><pre>${stdout}</pre>`);
    });
});

// 5. IDOR (CORREGIDO: Control de Autorización)
app.get('/v5/idor/:id', (req, res) => {
    // Simulamos que el usuario logueado en la sesión es el ID 2 ('rafa')
    const sessionUserId = 2; 
    
    if (parseInt(req.params.id) !== sessionUserId) {
        return res.status(403).send("<h1>Error 403: Acceso Denegado</h1><p>No tienes permiso para ver esta cuenta.</p>");
    }

    db.get("SELECT username, account_balance FROM users WHERE id = ?", [req.params.id], (err, row) => {
        if(row) res.send(`<h1>Cuenta Bancaria</h1><p>Usuario: ${row.username}</p><p>Saldo: ${row.account_balance}</p>`);
        else res.send("Usuario no encontrado");
    });
});

// 6. Exposición de Datos Sensibles (CORREGIDO: Filtrado de columnas)
app.get('/v6/datos', (req, res) => {
    // Solo seleccionamos datos no sensibles, omitiendo la contraseña
    db.all("SELECT id, username, account_balance FROM users", [], (err, rows) => {
        res.send(`<h1>API de Usuarios Segura</h1><pre>${JSON.stringify(rows, null, 2)}</pre>`);
    });
});

// 7. Configuración de Seguridad Incorrecta (CORREGIDO: Manejo de errores genérico)
app.get('/v7/error', (req, res) => {
    try {
        const a = variableQueNoExiste; // Forzamos un fallo
    } catch (error) {
        // Registramos el error de forma interna para el desarrollador
        console.error("Error interno registrado:", error.message);
        // Mostramos un mensaje amigable y seguro al usuario final
        res.status(500).send(`<h1>Error del Servidor</h1><p>Ha ocurrido un problema técnico. Por favor, inténtelo de nuevo más tarde.</p>`);
    }
});

// 8. Autenticación Rota (CORREGIDO: Hasheo de contraseñas con bcrypt)
app.get('/v8/auth', (req, res) => {
    res.send(`<h1>Registro Seguro</h1><form method="POST"><input name="username" placeholder="Usuario"><input name="password" type="password" placeholder="Contraseña"><button>Registrarse</button></form>`);
});
app.post('/v8/auth', async (req, res) => {
    try {
        // Encriptamos la contraseña con un factor de coste de 10
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [req.body.username, hashedPassword]);
        res.send("Usuario registrado de forma segura. La contraseña ha sido encriptada.");
    } catch (err) {
        res.status(500).send("Error en el registro.");
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});