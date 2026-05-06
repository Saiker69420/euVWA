const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process'); // Necesario para Command Injection

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- 1. PREPARACIÓN DE LA BASE DE DATOS ---
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error(err.message);
    else {
        console.log("Conectado a SQLite.");
        // db.serialize obliga a que estas consultas se ejecuten en orden estricto
        db.serialize(() => {
            db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, account_balance TEXT)");
            db.run("CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY, text TEXT)");
            db.run("INSERT OR IGNORE INTO users (id, username, password, account_balance) VALUES (1, 'admin', 'SuperSecreto123', '50000$'), (2, 'rafa', 'rafa_pwd', '100$')");
        });
    }
});

// Ruta de inicio
app.get('/', (req, res) => {
    res.send(`<h1>euVWA - Menú Vulnerable</h1>
              <ul>
                <li><a href="/v1/xss-r">1. XSS Reflejado</a></li>
                <li><a href="/v2/xss-s">2. XSS Almacenado</a></li>
                <li><a href="/v3/sqli">3. Inyección SQL (SQLi)</a></li>
                <li><a href="/v4/cmd">4. Command Injection</a></li>
                <li><a href="/v5/idor/2">5. IDOR</a></li>
                <li><a href="/v6/datos">6. Sensitive Data Exposure</a></li>
                <li><a href="/v7/error">7. Security Misconfiguration</a></li>
                <li><a href="/v8/auth">8. Broken Authentication</a></li>
              </ul>`);
});

// --- 2. LAS 8 VULNERABILIDADES ---

// 1. XSS Reflejado
app.get('/v1/xss-r', (req, res) => {
    let nombre = req.query.nombre || 'Invitado';
    // VULNERABILIDAD: Imprime el parámetro directamente en el HTML sin filtrar
    res.send(`<h1>Buscador</h1> <p>Resultados para: ${nombre}</p> <p>Añade ?nombre=TuNombre en la URL</p>`);
});

// 2. XSS Almacenado
app.get('/v2/xss-s', (req, res) => {
    db.all("SELECT text FROM comments", [], (err, rows) => {
        let html = '<h1>Foro Público</h1><form method="POST"><input name="comentario"><button>Enviar</button></form><ul>';
        // VULNERABILIDAD: Muestra el contenido de la BD sin escapar los scripts HTML
        rows.forEach(r => html += `<li>${r.text}</li>`); 
        html += '</ul>';
        res.send(html);
    });
});
app.post('/v2/xss-s', (req, res) => {
    db.run(`INSERT INTO comments (text) VALUES ('${req.body.comentario}')`);
    res.redirect('/v2/xss-s');
});

// 3. Inyección SQL (SQLi)
app.get('/v3/sqli', (req, res) => {
    let user = req.query.user || '';
    // VULNERABILIDAD: Concatenación directa del input del usuario en la consulta
    let query = "SELECT * FROM users WHERE username = '" + user + "'";
    db.all(query, [], (err, rows) => {
        res.send(`<h1>Login Inseguro</h1><form><input name="user" placeholder="Usuario"><button>Buscar</button></form><p>Resultados: ${JSON.stringify(rows)}</p>`);
    });
});

// 4. Command Injection
app.get('/v4/cmd', (req, res) => {
    let ip = req.query.ip || '127.0.0.1';
    // VULNERABILIDAD: Ejecuta comandos de sistema concatenando inputs del usuario
    exec('ping -n 1 ' + ip, (err, stdout) => {
        res.send(`<h1>Herramienta Ping</h1><form><input name="ip" value="${ip}"><button>Ping</button></form><pre>${stdout}</pre>`);
    });
});

// 5. IDOR (Insecure Direct Object Reference)
app.get('/v5/idor/:id', (req, res) => {
    // VULNERABILIDAD: Muestra los datos privados basándose en el ID de la URL sin verificar si estás logueado como ese usuario
    db.get("SELECT username, account_balance FROM users WHERE id = " + req.params.id, (err, row) => {
        if(row) res.send(`<h1>Cuenta Bancaria</h1><p>Usuario: ${row.username}</p><p>Saldo: ${row.account_balance}</p>`);
        else res.send("Usuario no encontrado");
    });
});

// 6. Exposición de Datos Sensibles
app.get('/v6/datos', (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows) => {
        // VULNERABILIDAD: Expone toda la tabla (incluidas contraseñas) al cliente a través de la API
        res.send(`<h1>API de Usuarios</h1><pre>${JSON.stringify(rows, null, 2)}</pre>`);
    });
});

// 7. Configuración de Seguridad Incorrecta
app.get('/v7/error', (req, res) => {
    try {
        const a = variableQueNoExiste; // Forzamos un fallo
    } catch (error) {
        // VULNERABILIDAD: Muestra la traza del error del servidor, exponiendo rutas internas del sistema al atacante
        res.status(500).send(`<h1>Error Fatal del Servidor</h1><pre>${error.stack}</pre>`);
    }
});

// 8. Autenticación Rota
app.get('/v8/auth', (req, res) => {
    res.send(`<h1>Registro</h1><form method="POST"><input name="username" placeholder="Usuario"><input name="password" type="password" placeholder="Contraseña"><button>Registrarse</button></form>`);
});
app.post('/v8/auth', (req, res) => {
    // VULNERABILIDAD: Guarda la contraseña en la base de datos exactamente como se escribió (texto plano)
    db.run(`INSERT INTO users (username, password) VALUES ('${req.body.username}', '${req.body.password}')`);
    res.send("Usuario registrado. Ve a la vulnerabilidad 6 para comprobar que tu contraseña está visible para todos.");
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});