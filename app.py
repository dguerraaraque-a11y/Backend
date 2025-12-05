from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from authlib.integrations.flask_client import OAuth
import bcrypt
from datetime import datetime
import os 
import secrets 
import pusher # Librería para la solución del chat

# --- INICIALIZACIÓN DE LA APLICACIÓN ---

# Leer la DATABASE_URL de las variables de entorno de Vercel. 
# Si no está en Vercel, intenta usar SQLite (que fallará, pero es el fallback local).
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///glauncher.db')

# Configuración de Pusher (Claves leídas de Vercel)
pusher_client = pusher.Pusher(
    app_id=os.environ.get('PUSHER_APP_ID', '1234567'),  
    key=os.environ.get('PUSHER_KEY', 'default_key'),    
    secret=os.environ.get('PUSHER_SECRET', 'default_secret'), 
    cluster=os.environ.get('PUSHER_CLUSTER', 'us2'),    
    ssl=True
)

# Inicialización de Flask: configuración simple para Serverless
app = Flask(__name__) 
oauth = OAuth(app)

# Claves y DB
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(16))
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- MODELOS DE BASE DE DATOS ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=True)  
    security_code = db.Column(db.String(6), nullable=True)   
    provider = db.Column(db.String(50), nullable=True)       
    social_id = db.Column(db.String(200), nullable=True, unique=True)
    avatar_url = db.Column(db.String(512), nullable=True)    

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    content = db.Column(db.String(500), nullable=False)
    message_type = db.Column(db.String(10), nullable=False, default='text') 
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {'id': self.id, 'username': self.username, 'content': self.content, 'type': self.message_type, 'timestamp': self.timestamp.isoformat()}

# --- CONFIGURACIÓN DE OAUTH 2.0 (Usando Variables de Entorno) ---
# Se asume que GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MICROSOFT_CLIENT_ID, y MICROSOFT_CLIENT_SECRET 
# están definidos en las variables de entorno de Vercel.
oauth.register(
    name='google',
    client_id=os.environ.get('GOOGLE_CLIENT_ID', '71330665801-6joq0752g7hhhp2hmld06hrfg67rhji0.apps.googleusercontent.com'),
    client_secret=os.environ.get('GOOGLE_CLIENT_SECRET', 'GOCSPX-PbP6MmjFDHa3AhpRLF5dmP2atp-'),
    access_token_url='https://accounts.google.com/o/oauth2/token',
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    userinfo_endpoint='https://openidconnect.googleapis.com/v1/userinfo',
    client_kwargs={'scope': 'openid email profile'},
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration'
)

oauth.register(
    name='microsoft',
    client_id=os.environ.get('MICROSOFT_CLIENT_ID', '4f73ba40-20f8-4625-aca8-dc876ae081c7'),
    client_secret=os.environ.get('MICROSOFT_CLIENT_SECRET', 'dbaef09f-d1c9-41c5-9417-3ec09c99583a'), 
    authorize_url='https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    access_token_url='https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userinfo_endpoint='https://graph.microsoft.com/v1.0/me',
    client_kwargs={'scope': 'User.Read'},
)

# --- RUTAS DE LA APLICACIÓN ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        user = User.query.filter_by(username=username).first()
        if user and bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
            session['username_for_2fa'] = username
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'message': 'Usuario o contraseña incorrectos.'}), 401
    return render_template('login.html')

@app.route('/verify-code', methods=['POST'])
def verify_code():
    data = request.get_json()
    code = data.get('code')
    username = session.get('username_for_2fa')
    if not username:
        return jsonify({'success': False, 'message': 'Sesión expirada. Vuelve a intentarlo.'}), 400
    user = User.query.filter_by(username=username).first()
    if user and user.security_code == code:
        session['logged_in'] = True
        session['username'] = username
        session.pop('username_for_2fa', None) 
        return jsonify({'success': True, 'redirect_url': url_for('dashboard')})
    else:
        return jsonify({'success': False, 'message': 'Código incorrecto o caducado.'}), 401

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        security_code = data.get('security_code')
        if User.query.filter_by(username=username).first():
            return jsonify({'success': False, 'message': 'El nombre de usuario ya existe.'}), 409
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        new_user = User(username=username, password_hash=hashed_password, security_code=security_code)
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'success': True, 'message': '¡Registro exitoso! Ahora puedes iniciar sesión.'})
    return render_template('register.html')

@app.route('/noticias')
def noticias():
    return render_template('noticias.html')

@app.route('/download')
def download():
    return render_template('download.html')

@app.route('/radio')
def radio():
    return render_template('radio.html')

@app.route('/dashboard')
def dashboard():
    if 'logged_in' in session and session['logged_in']:
        return render_template('dashboard.html')
    else:
        return redirect(url_for('login'))

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    session.pop('username_for_2fa', None)
    session.pop('username', None)
    return redirect(url_for('index'))

# --- API para Noticias ---
@app.route('/api/news')
def get_news():
    news_data = [
        {
            "title": "¡La actualización 1.21 \"Tricky Trials\" ya está aquí!",
            "date": "13 JUN 2024",
            "category": "juego",
            "summary": "¡La aventura te espera! Adéntrate en las Cámaras de Desafío, enfréntate a nuevos enemigos como el Breeze y el Bogged, y fabrica la poderosa Maza. Esta actualización está llena de retos y recompensas.",
            "image": "/images/TRICKY_TRIALS.jpg", 
            "link": "https://es.minecraft.wiki/w/Tricky_Trials",
            "icon": "fa-dungeon",
            "buttonText": "Leer más"
        },
        {
            "title": "Explora el mundo de \"Trails & Tales\" (1.20)",
            "date": "07 JUN 2023",
            "category": "juego",
            "summary": "La actualización 1.20 trajo la arqueología, los sniffers, camellos, y los hermosos biomas de cerezos. ¡Es hora de crear tus propias historias mientras exploras un mundo más vivo que nunca!",
            "image": "/images/Trails and Tales.jpg", 
            "link": "https://minecraft.wiki/w/Trails_%26_Tales",
            "icon": "fa-map-signs",
            "buttonText": "Leer más"
        },
        {
            "title": "¡GLauncher se asocia con TropiRumba!",
            "date": "20 OCT 2025",
            "category": "oficial",
            "summary": "¡Ahora puedes escuchar la mejor música mientras juegas! Nos hemos asociado con la radio TropiRumba Stereo 89.7 FM. Accede directamente desde el botón \"Radio\" en el launcher.",
            "image": "/images/GLauncher_X_TropiRumba.png", 
            "link": "radio.html",
            "icon": "fa-broadcast-tower",
            "buttonText": "Escuchar Ahora"
        },
    ]
    return jsonify(news_data)

# --- APIs de Usuario y Chat ---
@app.route('/api/user_info')
def user_info():
    if 'logged_in' in session and session.get('logged_in'):
        user = User.query.filter_by(username=session.get('username')).first()
        if user:
            return jsonify({
                'username': user.username, 
                'is_admin': False, 
                'avatar_url': user.avatar_url
            })
    return jsonify({'error': 'No autenticado'}), 401

@app.route('/api/chat_messages')
def get_chat_messages():
    since_timestamp_str = request.args.get('since')
    query = ChatMessage.query
    if since_timestamp_str:
        try:
            from datetime import timezone
            # Asume que el formato de fecha es correcto si viene del cliente
            since_timestamp = datetime.fromisoformat(since_timestamp_str.replace('Z', '+00:00'))
            query = query.filter(ChatMessage.timestamp > since_timestamp)
        except ValueError:
            return jsonify({"error": "Formato de fecha inválido"}), 400
    else:
        # Si no hay 'since', obtiene los últimos 50 mensajes
        query = query.order_by(ChatMessage.timestamp.desc()).limit(50)
    
    # Asegura el orden ascendente para mostrar el chat correctamente
    messages = query.order_by(ChatMessage.timestamp.asc()).all()
    return jsonify([msg.to_dict() for msg in messages])

@app.route('/api/chat_messages/create', methods=['POST'])
def create_chat_message():
    data = request.get_json()
    if not data or not data.get('content'):
        return jsonify({'error': 'El contenido no puede estar vacío'}), 400
    
    new_message = ChatMessage(
        username=data.get('username', 'Anónimo'),
        content=data.get('content'),
        message_type=data.get('type', 'text')
    )
    db.session.add(new_message)
    db.session.commit()
    
    # LÓGICA DE PUSHER (Notifica a los clientes)
    try:
        pusher_client.trigger('chat_radio', 'new_message', new_message.to_dict())
    except Exception as e:
        print(f"Error al enviar mensaje por Pusher: {e}") 
        
    return jsonify(new_message.to_dict()), 201

# --- Rutas para OAuth (Google y Microsoft) ---
@app.route('/login/google')
def login_google():
    redirect_uri = url_for('auth_google', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

@app.route('/login/google/callback')
def auth_google():
    token = oauth.google.authorize_access_token()
    user_info = oauth.google.get('userinfo').json() 
    social_id = user_info.get('sub')
    avatar = user_info.get('picture') 
    if not social_id:
        return 'Error: No se pudo obtener el ID de usuario de Google.', 400
    user = User.query.filter_by(provider='google', social_id=social_id).first()
    if not user:
        username = user_info.get('name', user_info.get('given_name', f"user_{social_id[:8]}"))
        if User.query.filter_by(username=username).first():
            username = f"{username}_{social_id[:4]}"
        new_user = User(username=username, provider='google', social_id=social_id, avatar_url=avatar)
        db.session.add(new_user)
        db.session.commit()
        user = new_user
    session['logged_in'] = True
    session['username'] = user.username
    return redirect(url_for('dashboard'))

@app.route('/login/microsoft')
def login_microsoft():
    redirect_uri = url_for('auth_microsoft', _external=True)
    return oauth.microsoft.authorize_redirect(redirect_uri)

@app.route('/login/microsoft/callback')
def auth_microsoft():
    token = oauth.microsoft.authorize_access_token()
    user_info = oauth.microsoft.get('me').json()
    social_id = user_info.get('id')
    if not social_id:
        return 'Error: No se pudo obtener el ID de usuario de Microsoft.', 400
    user = User.query.filter_by(provider='microsoft', social_id=social_id).first()
    if not user:
        username = user_info.get('displayName', f"user_{social_id[:8]}")
        if User.query.filter_by(username=username).first():
            username = f"{username}_{social_id[:4]}"
        new_user = User(username=username, provider='microsoft', social_id=social_id)
        db.session.add(new_user)
        db.session.commit()
        user = new_user
    session['logged_in'] = True
    session['username'] = user.username
    return redirect(url_for('dashboard'))

# --------------------------------------------------------------------------------------
# --- RUTAS PERSONALIZADAS PARA SERVIR ARCHIVOS ESTÁTICOS (SOLUCIÓN CSS/JS/IMAGENES) ---
# --------------------------------------------------------------------------------------
# Estas rutas mapean las URL como /css/style.css a la carpeta física 'css' en la raíz.
@app.route('/css/<path:filename>')
def serve_css(filename):
    """Sirve archivos CSS desde la carpeta 'css'."""
    return send_from_directory('css', filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    """Sirve archivos JS desde la carpeta 'js'."""
    return send_from_directory('js', filename)

@app.route('/images/<path:filename>')
def serve_images(filename):
    """Sirve archivos de imágenes desde la carpeta 'images'."""
    return send_from_directory('images', filename)

@app.route('/sounds/<path:filename>')
def serve_sounds(filename):
    """Sirve archivos de sonido desde la carpeta 'sounds'."""
    return send_from_directory('sounds', filename)
    
# Ruta para archivos estáticos específicos que se encuentran en la raíz (ej. co-style-style.css)
@app.route('/<path:filename>')
def serve_root_files(filename):
    """Sirve archivos estáticos que se encuentran directamente en la raíz del proyecto."""
    safe_files = ['co-style-style.css', 'favicon.ico', 'glauncher.ico', 'sitemap.xml', 'robots.txt']
    if filename in safe_files:
        return send_from_directory('.', filename)
    return '', 404 
    
# -------------------------------------------------------------
# *** NOTA: El bloque de ejecución local ha sido ELIMINADO para compatibilidad con Vercel. ***
# -------------------------------------------------------------