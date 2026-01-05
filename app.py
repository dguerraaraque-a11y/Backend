from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
from flask_cors import CORS
from authlib.integrations.flask_client import OAuth
import bcrypt
import jwt
from datetime import datetime
import os 
import secrets 
import pusher # Librería para la solución del chat
from functools import wraps
import google.generativeai as genai
import json
from PIL import Image
from datetime import timedelta
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import mimetypes

ALLOWED_EXTENSIONS = {'bbmodel', 'json', 'obj'}
# --- INICIALIZACIÓN DE LA APLICACIÓN ---


# Configuración de Pusher (Claves leídas de Vercel)
pusher_client = pusher.Pusher(
    app_id=os.environ.get('PUSHER_APP_ID', '1234567'),  
    key=os.environ.get('PUSHER_KEY', 'default_key'),    
    secret=os.environ.get('PUSHER_SECRET', 'default_secret'), 
    cluster=os.environ.get('PUSHER_CLUSTER', 'us2'),    
    ssl=True
)

# --- CONFIGURACIÓN DE RUTAS Y CARPETAS ---
current_dir = os.path.abspath(os.path.dirname(__file__))
# La carpeta 'static' (con test_suite.html) ahora está DENTRO de la carpeta 'BACKEND'.
static_dir = os.path.join(current_dir, 'static')
MODELS_DIR = os.path.join(static_dir, 'models')
# La carpeta raíz del frontend (GLAUNCHER-WEB) está al mismo nivel que BACKEND.
frontend_dir = os.path.join(current_dir, '..', 'GLAUNCHER-WEB')

# URL del frontend para redirecciones seguras
FRONTEND_DASHBOARD_URL = 'https://glauncher.vercel.app/dashboard.html'
FRONTEND_LOGIN_URL = 'https://glauncher.vercel.app/login.html'
FRONTEND_REDIRECT_URL = 'https://glauncher.vercel.app/redirect.html'

# Configuración de la base de datos.
# En producción (Render), usa la variable de entorno DATABASE_URL.
# En local, crea un archivo 'glauncher.db' en la nueva carpeta 'static/data'.
data_dir = os.path.join(static_dir, 'data')
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(data_dir, exist_ok=True) # Asegura que la carpeta 'data' exista.
local_db_path = os.path.join(data_dir, 'glauncher.db')
DATABASE_URL = os.environ.get('DATABASE_URL', f'sqlite:///{local_db_path}')

# Inicializamos Flask.
# - `template_folder`: Apunta a la raíz para encontrar los HTML principales (index.html, etc.).
# - `static_folder`: Apunta a la nueva carpeta 'static' para servir los archivos de prueba.
app = Flask(__name__,
            template_folder=frontend_dir,
            static_folder=frontend_dir,
            static_url_path='' # Permite que /css/styles.css funcione directamente
           )
# Habilitar CORS para permitir peticiones desde cualquier origen.
# Es útil para desarrollo y para cuando el frontend y backend están en dominios diferentes.
CORS(app, supports_credentials=True)

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
    registration_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    role = db.Column(db.String(50), nullable=False, default='Pico de madera')
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    gcoins = db.Column(db.Integer, default=0, nullable=False)
    status = db.Column(db.String(50), default='Disponible', nullable=False) # 'Disponible', 'Ausente', 'Jugando'
    phone_number = db.Column(db.String(20), nullable=True)
    
    # Campos para el sistema de baneos
    is_banned = db.Column(db.Boolean, default=False, nullable=False)
    banned_until = db.Column(db.DateTime, nullable=True)
    ban_reason = db.Column(db.String(255), nullable=True)

    # Campos de control de tiempo
    last_message_time = db.Column(db.DateTime, nullable=True)
    last_typing_time = db.Column(db.DateTime, nullable=True)
    last_daily_reward_claim = db.Column(db.DateTime, nullable=True)

    # Nuevos campos para estadísticas del dashboard
    play_time_seconds = db.Column(db.Integer, default=0, nullable=False)
    friends_count = db.Column(db.Integer, default=0, nullable=False)
    followers_count = db.Column(db.Integer, default=0, nullable=False)
    following_count = db.Column(db.Integer, default=0, nullable=False)

    # Relación para saber qué cosméticos posee el usuario
    owned_cosmetics = db.relationship('CosmeticItem', secondary='user_cosmetic', backref='owners')


GOOGLE_CLIENT_ID="your_actual_google_client_id_here"
GOOGLE_CLIENT_SECRET="your_actual_google_client_secret_here"
="your_actual_microsoft_client_id_here"
MICROSOFT_CLIENT_SECRET="your_actual_microsoft_client_secret_here"
# ... and other keys like SECRET_KEY, PUSHER_APP_ID, etc.
# Nuevo modelo para amistades
class Friendship(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    friend_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    # 'pending', 'accepted'
    status = db.Column(db.String(20), nullable=False, default='pending')
    
    # Restricción para que no haya pares duplicados (ej: 1-2 y 2-1)
    __table_args__ = (
        db.UniqueConstraint('user_id', 'friend_id', name='_user_friend_uc'),
        db.CheckConstraint('user_id != friend_id', name='_user_id_not_friend_id'),
    )

# --- NUEVOS MODELOS PARA LOGROS Y REACCIONES ---
class Achievement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(255), nullable=False)
    icon = db.Column(db.String(100), nullable=False) # e.g., 'fas fa-star'
    rarity = db.Column(db.String(50), nullable=False, default='common') # common, rare, epic

class UserAchievement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    achievement_id = db.Column(db.Integer, db.ForeignKey('achievement.id'), nullable=False)
    unlocked_at = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.relationship('User', backref='unlocked_achievements')
    achievement = db.relationship('Achievement')

class AchievementReaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user_achievement_id = db.Column(db.Integer, db.ForeignKey('user_achievement.id'), nullable=False)
    reaction_type = db.Column(db.String(50), nullable=False, default='like') # like, love, etc.
    user = db.relationship('User')
    user_achievement = db.relationship('UserAchievement', backref=db.backref('reactions', cascade="all, delete-orphan"))

class LaunchMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    content = db.Column(db.String(200), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {'id': self.id, 'username': self.username, 'content': self.content, 
                'timestamp': self.timestamp.isoformat()}

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # Relación con el usuario que envió el mensaje (opcional)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    user = db.relationship('User', backref='chat_messages')

    username = db.Column(db.String(80), nullable=False)
    # Nuevos campos para guardar el estado del usuario al momento de enviar el mensaje
    role = db.Column(db.String(50), nullable=False, default='Invitado')
    username_color = db.Column(db.String(7), nullable=True) # Para guardar colores como #RRGGBB

    content = db.Column(db.String(500), nullable=False)
    message_type = db.Column(db.String(10), nullable=False, default='text') 
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'username': self.username, 'content': self.content, 
            'type': self.message_type, 'timestamp': self.timestamp.isoformat(),
            'role': self.role, 'username_color': self.username_color
        }

# Nuevo modelo para mensajes privados (GChat)
class PrivateMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    message_type = db.Column(db.String(10), nullable=False, default='text') # 'text' o 'image'
    is_read = db.Column(db.Boolean, default=False, nullable=False)

    sender = db.relationship('User', foreign_keys=[sender_id])
    recipient = db.relationship('User', foreign_keys=[recipient_id])

    def to_dict(self):
        return {'id': self.id, 'sender_id': self.sender_id, 'recipient_id': self.recipient_id, 'content': self.content, 
                'timestamp': self.timestamp.isoformat(), 'type': self.message_type}

class News(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    date = db.Column(db.String(20), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    summary = db.Column(db.Text, nullable=False)
    image = db.Column(db.String(255), nullable=True)
    link = db.Column(db.String(255), nullable=False)
    icon = db.Column(db.String(50), nullable=True)
    buttonText = db.Column(db.String(50), nullable=False)

class Download(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    platform = db.Column(db.String(50), nullable=False)
    version = db.Column(db.String(50), nullable=False)
    icon_class = db.Column(db.String(50), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    filename = db.Column(db.String(255), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'platform': self.platform,
            'version': self.version,
            'icon_class': self.icon_class,
            'filename': self.filename
        }

class CosmeticItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), nullable=False)
    price = db.Column(db.Integer, nullable=False)
    rarity = db.Column(db.String(50), nullable=False, default='common') # common, rare, epic, legendary
    category = db.Column(db.String(50), nullable=False) # cape, wings, aura, head, emote
    image_path = db.Column(db.String(255), nullable=False) # Path a la imagen de preview
    model_path = db.Column(db.String(255), nullable=False) # Path al modelo 3D
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'description': self.description,
            'price': self.price, 'rarity': self.rarity, 'category': self.category,
            'image_url': self.image_path, # El frontend construirá la URL completa
        }

# Tabla de asociación para la relación muchos a muchos entre User y CosmeticItem
user_cosmetic = db.Table('user_cosmetic',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('cosmetic_item_id', db.Integer, db.ForeignKey('cosmetic_item.id'), primary_key=True)
)

# --- CONFIGURACIÓN DE OAUTH 2.0 (Usando Variables de Entorno) ---
# Se asume que GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MICROSOFT_CLIENT_ID, y MICROSOFT_CLIENT_SECRET 
# están definidos en las variables de entorno de Vercel.
oauth.register(
    name='google',
    client_id=os.environ.get('GOOGLE_CLIENT_ID') or 'MISSING_GOOGLE_ID',
    client_secret=os.environ.get('GOOGLE_CLIENT_SECRET') or 'MISSING_GOOGLE_SECRET',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

oauth.register(
    name='microsoft',
    client_id=os.environ.get('MICROSOFT_CLIENT_ID'),
    client_secret=os.environ.get('MICROSOFT_CLIENT_SECRET'),
    # Usar server_metadata_url para que authlib descubra los endpoints automáticamente.
    server_metadata_url='https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid profile email User.Read XboxLive.signin'},
)

# --- DECORADORES DE AUTENTICACIÓN ---

def admin_required(f):
    """Decorador para proteger rutas de administrador."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Para una API, es mejor verificar un token de admin o una sesión segura.
        # Esta implementación asume una sesión, pero podría mejorarse con tokens.
        if 'logged_in' not in session or not session.get('logged_in'):
            return jsonify({'message': 'Se requiere inicio de sesión de administrador'}), 401

        user = User.query.filter_by(username=session.get('username')).first()
        if not user or not user.is_admin:
            return jsonify({'message': 'Acceso denegado. No tienes permisos de administrador.'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def public_endpoint(f):
    """Decorador para marcar explícitamente una ruta como pública."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        return f(*args, **kwargs)
    return decorated_function

# --- RUTAS DE LA APLICACIÓN ---

@app.route('/')
def index():
    # Ahora la ruta raíz del backend sirve la página de pruebas.
    # Los usuarios normales accederán a través de glauncher.vercel.app, no de la URL de la API.
    return send_from_directory(static_dir, 'test_suite.html')

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    session.pop('username_for_2fa', None)
    session.pop('username', None)
    return redirect(url_for('index'))

# --- API DE AUTENTICACIÓN ---

@app.route('/api/auth/check_credentials', methods=['POST'])
def check_credentials():
    """Paso 1 del login: Verifica usuario y contraseña."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    user = User.query.filter_by(username=username).first()
    
    # Comprobar si el usuario está baneado
    if user and user.is_banned and user.banned_until and datetime.utcnow() < user.banned_until:
        tiempo_restante = user.banned_until - datetime.utcnow()
        dias, resto = divmod(tiempo_restante.total_seconds(), 86400)
        horas, resto = divmod(resto, 3600)
        return jsonify({'message': f'Tu cuenta está suspendida. Tiempo restante: {int(dias)}d {int(horas)}h.'}), 403

    if user and user.password_hash and bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
        # Credenciales correctas, el frontend puede proceder al paso 2
        return jsonify({'message': 'Credenciales válidas.'}), 200
    else:
        return jsonify({'message': 'Usuario o contraseña incorrectos.'}), 401

@app.route('/api/auth/login', methods=['POST'])
def api_login():
    """Paso 2 del login: Verifica todo y devuelve un token."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    security_code = data.get('security_code')

    user = User.query.filter_by(username=username).first()

    if user and user.is_banned and user.banned_until and datetime.utcnow() < user.banned_until:
        tiempo_restante = user.banned_until - datetime.utcnow()
        dias, resto = divmod(tiempo_restante.total_seconds(), 86400)
        horas, _ = divmod(resto, 3600)
        return jsonify({'message': f'Tu cuenta está suspendida. Tiempo restante: {int(dias)}d {int(horas)}h.'}), 403

    # Verificación completa
    if user and user.password_hash and bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
        if user.security_code == security_code:
            # ¡Todo correcto! Generamos el token.
            token = jwt.encode(
                {'user_id': user.id, 'username': user.username},
                app.secret_key,
                algorithm='HS256'
            )
            return jsonify({'message': 'Inicio de sesión exitoso.', 'token': token}), 200
        else:
            return jsonify({'message': 'Código de seguridad incorrecto.'}), 401
    else:
        # Esta comprobación es redundante si el flujo es correcto, pero es una salvaguarda.
        return jsonify({'message': 'Usuario o contraseña incorrectos.'}), 401

@app.route('/api/auth/complete_registration', methods=['POST'])
def complete_social_registration():
    """
    Finaliza el registro para un usuario que viene de un login social.
    Recibe el token temporal y los datos del formulario.
    """
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'message': 'Token de sesión social no proporcionado.'}), 401

    temp_token = auth_header.split(' ')[1]

    try:
        # Decodificar el token temporal para obtener el social_id
        data = jwt.decode(temp_token, app.secret_key, algorithms=['HS256'])
        social_id = data.get('social_id')
        if not social_id:
            raise jwt.InvalidTokenError

        # Buscar al usuario que necesita completar el registro
        user = User.query.filter_by(social_id=social_id).first()
        if not user:
            return jsonify({'message': 'Usuario no encontrado o sesión inválida.'}), 404

        # Procesar datos del formulario
        username = request.form.get('username')
        password = request.form.get('password')
        phone_number = request.form.get('phone_number')

        # Validar que el nombre de usuario no esté ya en uso por otro usuario
        if User.query.filter(User.username == username, User.social_id != social_id).first():
            return jsonify({'message': 'Ese nombre de usuario ya está en uso.'}), 409

        # Actualizar datos del usuario
        user.username = username
        user.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        if phone_number:
            user.phone_number = phone_number

        # Procesar la imagen de perfil si se subió
        if 'profile_picture' in request.files:
            file = request.files['profile_picture']
            if file.filename != '':
                avatar_filename = secrets.token_hex(8) + os.path.splitext(file.filename)[1]
                avatar_path = os.path.join(static_dir, 'images', 'avatars', avatar_filename)
                file.save(avatar_path)
                user.avatar_url = f'/images/avatars/{avatar_filename}'

        db.session.commit()

        # Generar y devolver un token de sesión permanente
        final_token = jwt.encode({'user_id': user.id, 'username': user.username}, app.secret_key, algorithm='HS256')
        return jsonify({'message': '¡Registro completado con éxito!', 'token': final_token}), 200

    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'message': 'Tu sesión de registro ha expirado. Por favor, vuelve a iniciar sesión.'}), 401

@app.route('/verify-code', methods=['POST'])
def verify_code():
    # Esta ruta ya no es necesaria con el nuevo flujo de API, pero la dejamos por si se usa en otro lado.
    # Se recomienda migrar completamente a /api/auth/login
    return jsonify({'message': 'Esta ruta está obsoleta. Usa /api/auth/login.'}), 404

# --- API para Noticias ---
@app.route('/api/news')
def get_news():
    try:
        news_items = News.query.order_by(News.id.desc()).all()
        if news_items:
            news_data = [{
                "id": item.id, "title": item.title, "date": item.date,
                "category": item.category, "summary": item.summary, "image": item.image,
                "link": item.link, "icon": item.icon, "buttonText": item.buttonText
            } for item in news_items]
            return jsonify(news_data)
    except Exception as e:
        print(f"Error al acceder a la tabla News: {e}. Devolviendo datos de ejemplo.")

    # Si la tabla no existe, está vacía, o hay un error, devuelve datos de ejemplo.
    return jsonify([
        {
                "id": 1,
                "title": "¡Bienvenido al nuevo GLauncher!",
                "date": "20 OCT 2025",
                "category": "oficial",
                "summary": "Esta es una noticia de ejemplo. El panel de administración ahora está conectado a la base de datos. ¡Crea tu primera noticia!",
                "image": "/images/GLauncher_X_TropiRumba.png",
                "link": "#",
                "icon": "fa-rocket",
                "buttonText": "Empezar"
        }
    ])

@app.route('/api/downloads')
def get_downloads():
    downloads = Download.query.all()
    return jsonify([{'id': d.id, 'platform': d.platform, 'version': d.version, 'icon_class': d.icon_class} for d in downloads])

@app.route('/api/download/windows')
def download_windows():
    """Ruta para descargar el instalador de Windows (.exe)."""
    try:
        # Asegúrate de crear la carpeta 'downloads' en GLAUNCHER-WEB y poner ahí el .exe
        downloads_dir = os.path.join(frontend_dir, 'downloads')
        return send_from_directory(downloads_dir, 'GLauncher_Setup.exe', as_attachment=True)
    except Exception as e:
        return jsonify({'error': 'El instalador no se encuentra disponible.'}), 404

@app.route('/api/updates/latest')
def get_latest_version():
    """Devuelve la última versión disponible para la plataforma solicitada."""
    platform = request.args.get('platform', 'windows')
    download = Download.query.filter_by(platform=platform).order_by(Download.id.desc()).first()
    
    if download:
        return jsonify({
            'version': download.version,
            'url': 'https://glauncher.vercel.app/download.html'
        })
    return jsonify({'version': '1.0.0', 'url': ''})

@app.route('/api/download/update-jar')
def download_update_jar():
    """Sirve el archivo .jar suelto para la auto-actualización."""
    try:
        # Asegúrate de copiar el GLauncher.jar compilado a la carpeta downloads del servidor
        downloads_dir = os.path.join(frontend_dir, 'downloads')
        return send_from_directory(downloads_dir, 'GLauncher.jar', as_attachment=True)
    except Exception as e:
        return jsonify({'error': 'Archivo de actualización no encontrado.'}), 404

@app.route('/api/downloads/create', methods=['POST'])
@admin_required
def create_download():
    """Sube un nuevo archivo de descarga y lo registra en la base de datos."""
    if 'download_file' not in request.files:
        return jsonify({'message': 'No se subió ningún archivo.'}), 400
    
    file = request.files['download_file']
    platform = request.form.get('platform')
    version = request.form.get('version')
    icon_class = request.form.get('icon_class')

    if file.filename == '':
        return jsonify({'message': 'Nombre de archivo vacío.'}), 400

    if file:
        filename = secure_filename(file.filename)
        downloads_dir = os.path.join(frontend_dir, 'downloads')
        os.makedirs(downloads_dir, exist_ok=True)
        file_path = os.path.join(downloads_dir, filename)
        file.save(file_path)
        
        new_download = Download(
            platform=platform,
            version=version,
            icon_class=icon_class,
            file_path=f'/downloads/{filename}',
            filename=filename
        )
        db.session.add(new_download)
        db.session.commit()
        return jsonify({'message': 'Archivo subido y registrado con éxito.'}), 201
    
    return jsonify({'message': 'Error al subir el archivo.'}), 500

@app.route('/api/downloads/delete/<int:download_id>', methods=['DELETE'])
@admin_required
def delete_download(download_id):
    """Elimina un registro de descarga y el archivo físico asociado."""
    download = Download.query.get(download_id)
    if not download:
        return jsonify({'message': 'Descarga no encontrada.'}), 404
    
    try:
        # Intentar borrar el archivo físico
        downloads_dir = os.path.join(frontend_dir, 'downloads')
        file_path = os.path.join(downloads_dir, download.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
        
        db.session.delete(download)
        db.session.commit()
        return jsonify({'message': 'Descarga eliminada correctamente.'}), 200
    except Exception as e:
        return jsonify({'message': f'Error al eliminar: {str(e)}'}), 500

# --- Lógica de Roles de Usuario ---
def update_user_role(user):
    """Calcula y actualiza el rol de un usuario basado en la antigüedad de su cuenta."""
    if user.is_admin:
        new_role = "Pico de Netherite"
    else:
        months_since_registration = (datetime.utcnow() - user.registration_date).days / 30.44
        if months_since_registration >= 8:
            new_role = "Pico de Diamante"
        elif months_since_registration >= 5:
            new_role = "Pico de Oro"
        elif months_since_registration >= 3:
            new_role = "Pico de Hierro"
        elif months_since_registration >= 2:
            new_role = "Pico de Piedra"
        else:
            new_role = "Pico de madera"

    if user.role != new_role:
        user.role = new_role
        db.session.commit()

# --- APIs de Usuario y Chat ---
@app.route('/api/user_info')
def user_info():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'No autenticado. Token no proporcionado.'}), 401

    token = auth_header.split(' ')[1]
    try:
        data = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        user = User.query.filter_by(id=data['user_id']).first()
        if user:
            update_user_role(user)
            return jsonify({
                'username': user.username,
                'is_admin': user.is_admin,
                'avatar_url': user.avatar_url,
                'role': user.role,
                'gcoins': user.gcoins,
                'status': user.status,
                'owned_cosmetics': [cosmetic.id for cosmetic in user.owned_cosmetics]
            })
        else:
            return jsonify({'error': 'Usuario no encontrado.'}), 404
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expirado.'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Token inválido.'}), 401
    finally:
        db.session.remove()

# --- API para Amigos ---
@app.route('/api/friends', methods=['GET'])
def get_friends():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'No autenticado.'}), 401

    token = auth_header.split(' ')[1]
    try:
        data = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        user_id = data['user_id']

        # Amigos aceptados
        friends1 = db.session.query(User).join(Friendship, Friendship.friend_id == User.id)\
            .filter(Friendship.user_id == user_id, Friendship.status == 'accepted').all()
        friends2 = db.session.query(User).join(Friendship, Friendship.user_id == User.id)\
            .filter(Friendship.friend_id == user_id, Friendship.status == 'accepted').all()
        
        accepted_friends = list(set(friends1 + friends2))

        # Solicitudes pendientes (enviadas por otros hacia mí)
        pending_requests = db.session.query(User).join(Friendship, Friendship.user_id == User.id)\
            .filter(Friendship.friend_id == user_id, Friendship.status == 'pending').all()

        # Solicitudes que yo he enviado
        sent_requests = db.session.query(User).join(Friendship, Friendship.friend_id == User.id)\
            .filter(Friendship.user_id == user_id, Friendship.status == 'pending').all()

        return jsonify({
            'friends': [{'id': u.id, 'username': u.username, 'avatar_url': u.avatar_url, 'role': u.role, 'status': u.status, 'last_typing_time': u.last_typing_time.isoformat() if u.last_typing_time else None} for u in accepted_friends],
            'pending': [{'id': u.id, 'username': u.username, 'avatar_url': u.avatar_url, 'role': u.role, 'status': u.status} for u in pending_requests],
            'sent': [{'id': u.id, 'username': u.username, 'avatar_url': u.avatar_url, 'role': u.role, 'status': u.status} for u in sent_requests]
        })

    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'error': 'Token inválido o expirado.'}), 401

@app.route('/api/friends/add', methods=['POST'])
def add_friend():
    auth_header = request.headers.get('Authorization')
    if not auth_header: return jsonify({'message': 'No autenticado.'}), 401
    token = auth_header.split(' ')[1]
    
    try:
        data = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        user_id = data['user_id']
        friend_username = request.json.get('username')

        if not friend_username:
            return jsonify({'message': 'Nombre de usuario no proporcionado.'}), 400

        friend = User.query.filter_by(username=friend_username).first()

        if not friend:
            return jsonify({'message': 'Usuario no encontrado.'}), 404
        if friend.id == user_id:
            return jsonify({'message': 'No puedes agregarte a ti mismo.'}), 400

        # Comprobar si ya existe una amistad o solicitud
        existing_friendship = Friendship.query.filter(
            ((Friendship.user_id == user_id) & (Friendship.friend_id == friend.id)) |
            ((Friendship.user_id == friend.id) & (Friendship.friend_id == user_id))
        ).first()

        if existing_friendship:
            if existing_friendship.status == 'accepted':
                return jsonify({'message': 'Ya eres amigo de este usuario.'}), 409
            else:
                return jsonify({'message': 'Ya existe una solicitud de amistad pendiente.'}), 409

        new_friendship = Friendship(user_id=user_id, friend_id=friend.id, status='pending')
        db.session.add(new_friendship)
        db.session.commit()

        return jsonify({'message': f'Solicitud de amistad enviada a {friend.username}.'}), 201

    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'message': 'Token inválido o expirado.'}), 401

@app.route('/api/friends/accept', methods=['POST'])
def accept_friend():
    auth_header = request.headers.get('Authorization')
    if not auth_header: return jsonify({'message': 'No autenticado.'}), 401
    token = auth_header.split(' ')[1]
    
    try:
        data = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        user_id = data['user_id'] # El que acepta la solicitud
        friend_id = request.json.get('friend_id') # El que envió la solicitud

        friendship = Friendship.query.filter_by(user_id=friend_id, friend_id=user_id, status='pending').first()

        if not friendship:
            return jsonify({'message': 'Solicitud de amistad no encontrada.'}), 404

        friendship.status = 'accepted'
        db.session.commit()
        return jsonify({'message': 'Solicitud de amistad aceptada.'}), 200

    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'message': 'Token inválido o expirado.'}), 401

@app.route('/api/friends/remove', methods=['POST'])
def remove_friend():
    auth_header = request.headers.get('Authorization')
    if not auth_header: return jsonify({'message': 'No autenticado.'}), 401
    token = auth_header.split(' ')[1]
    
    try:
        data = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        user_id = data['user_id']
        friend_id = request.json.get('friend_id')

        # Buscar la amistad en cualquier dirección
        friendship = Friendship.query.filter(
            ((Friendship.user_id == user_id) & (Friendship.friend_id == friend_id)) |
            ((Friendship.user_id == friend_id) & (Friendship.friend_id == user_id))
        ).first()

        if not friendship:
            return jsonify({'message': 'Relación de amistad no encontrada.'}), 404

        db.session.delete(friendship)
        db.session.commit()
        return jsonify({'message': 'Amigo eliminado/solicitud rechazada correctamente.'}), 200

    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'message': 'Token inválido o expirado.'}), 401

# --- API para Ajustes de Usuario ---
@app.route('/api/user/update_profile', methods=['POST'])
def update_profile():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'message': 'No autenticado.'}), 401

    token = auth_header.split(' ')[1]
    try:
        data = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        user = User.query.filter_by(id=data['user_id']).first()
        if not user:
            return jsonify({'message': 'Usuario no encontrado.'}), 404

        # Actualizar nombre de usuario
        new_username = request.form.get('username')
        if new_username and new_username != user.username:
            if User.query.filter(User.username == new_username).first():
                return jsonify({'message': 'Ese nombre de usuario ya está en uso.'}), 409
            user.username = new_username

        # Actualizar contraseña
        new_password = request.form.get('password')
        if new_password:
            password_confirm = request.form.get('password_confirm')
            if new_password != password_confirm:
                return jsonify({'message': 'Las contraseñas no coinciden.'}), 400
            user.password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Actualizar avatar
        if 'avatar_file' in request.files:
            file = request.files['avatar_file']
            if file.filename != '':
                # Guardar el archivo de forma segura
                avatar_filename = secrets.token_hex(8) + os.path.splitext(file.filename)[1]
                avatars_dir = os.path.join(static_dir, 'images', 'avatars')
                os.makedirs(avatars_dir, exist_ok=True)
                avatar_path = os.path.join(avatars_dir, avatar_filename)
                file.save(avatar_path)
                user.avatar_url = f'/images/avatars/{avatar_filename}'

        db.session.commit()
        return jsonify({'message': 'Perfil actualizado con éxito. Los cambios se reflejarán la próxima vez que inicies sesión.'}), 200

    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'message': 'Token inválido o expirado.'}), 401
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Ocurrió un error: {str(e)}'}), 500

@app.route('/api/user/status', methods=['POST'])
def update_status():
    auth_header = request.headers.get('Authorization')
    if not auth_header: return jsonify({'message': 'No autenticado.'}), 401
    token = auth_header.split(' ')[1]

    try:
        data = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        user = User.query.get(data['user_id'])
        if not user:
            return jsonify({'message': 'Usuario no encontrado.'}), 404

        new_status = request.json.get('status')
        allowed_statuses = ['Disponible', 'Ausente', 'Jugando']
        if new_status not in allowed_statuses:
            return jsonify({'message': 'Estado no válido.'}), 400

        user.status = new_status
        db.session.commit()

        # Notificar a otros usuarios del cambio de estado
        pusher_client.trigger(
            'presence-glauncher-users', 'status-update', 
            {'user_id': user.id, 'status': user.status}
        )

        return jsonify({'message': f'Estado actualizado a "{new_status}".'}), 200
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'message': 'Token inválido o expirado.'}), 401
# --- API para la Tienda ---
@app.route('/api/shop/claim_daily_reward', methods=['POST'])
def claim_daily_reward():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'No autenticado.'}), 401

    token = auth_header.split(' ')[1]
    try:
        data = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        user = User.query.filter_by(id=data['user_id']).first()

        if not user:
            return jsonify({'error': 'Usuario no encontrado.'}), 404

        now = datetime.utcnow()
        # Comprobar si ya se reclamó en las últimas 24 horas
        if user.last_daily_reward_claim and (now - user.last_daily_reward_claim).total_seconds() < 86400: # 24 horas
            return jsonify({'message': 'Ya has reclamado tu recompensa diaria.'}), 429

        # Otorgar la recompensa (ej: 50 GCoins)
        reward_amount = 50
        user.gcoins += reward_amount
        user.last_daily_reward_claim = now
        db.session.commit()

        return jsonify({'message': f'¡Has reclamado {reward_amount} GCoins!', 'new_balance': user.gcoins}), 200
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'error': 'Token inválido o expirado.'}), 401

@app.route('/api/shop/items')
def get_shop_items():
    # Lógica de tienda diaria:
    # En un futuro, aquí se podría seleccionar un conjunto de ítems basado en la fecha.
    # Por ahora, devolvemos todos los ítems activos.
    try:
        items = CosmeticItem.query.filter_by(is_active=True).all()
        return jsonify([item.to_dict() for item in items])
    except Exception as e:
        print(f"Error al obtener ítems de la tienda: {e}")
        return jsonify({'error': 'No se pudieron cargar los artículos de la tienda.'}), 500

@app.route('/api/shop/purchase', methods=['POST'])
def purchase_item():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'message': 'Debes iniciar sesión para comprar.'}), 401

    token = auth_header.split(' ')[1]
    item_id = request.get_json().get('item_id')

    try:
        data = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        user = User.query.filter_by(id=data['user_id']).first()
        item = CosmeticItem.query.get(item_id)

        if not user or not item:
            return jsonify({'message': 'Usuario o artículo no encontrado.'}), 404

        if item in user.owned_cosmetics:
            return jsonify({'message': 'Ya posees este artículo.'}), 409

        if user.gcoins < item.price:
            return jsonify({'message': 'No tienes suficientes GCoins.'}), 402

        user.gcoins -= item.price
        user.owned_cosmetics.append(item)
        db.session.commit()

        return jsonify({'message': f'¡Has comprado "{item.name}" con éxito!', 'new_balance': user.gcoins}), 200
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'message': 'Tu sesión ha expirado. Vuelve a iniciar sesión.'}), 401

# --- API PARA LOGROS Y REACCIONES ---
@app.route('/api/achievements/react', methods=['POST'])
def react_to_achievement():
    auth_header = request.headers.get('Authorization')
    if not auth_header: return jsonify({'message': 'No autenticado.'}), 401
    token = auth_header.split(' ')[1]

    try:
        data = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        user_id = data['user_id']
        user_achievement_id = request.json.get('user_achievement_id')
        reaction_type = request.json.get('reaction_type', 'like')

        user_achievement = UserAchievement.query.get(user_achievement_id)
        if not user_achievement:
            return jsonify({'message': 'Logro de usuario no encontrado.'}), 404

        # Comprobar si el usuario ya reaccionó
        existing_reaction = AchievementReaction.query.filter_by(user_id=user_id, user_achievement_id=user_achievement_id).first()

        if existing_reaction:
            # Si ya existe, la eliminamos (toggle off)
            db.session.delete(existing_reaction)
        else:
            # Si no existe, la creamos (toggle on)
            new_reaction = AchievementReaction(user_id=user_id, user_achievement_id=user_achievement_id, reaction_type=reaction_type)
            db.session.add(new_reaction)
        
        db.session.commit()

        # Contar las reacciones y notificar a los clientes
        reaction_count = AchievementReaction.query.filter_by(user_achievement_id=user_achievement_id).count()
        pusher_client.trigger('dashboard', 'achievement-reaction-update', {'user_achievement_id': user_achievement_id, 'count': reaction_count})

        return jsonify({'message': 'Reacción actualizada.', 'new_count': reaction_count}), 200
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'message': 'Token inválido o expirado.'}), 401

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/admin/cosmetics/create', methods=['POST'])
@admin_required
def create_cosmetic_item():
    if 'model_file' not in request.files or 'image_file' not in request.files:
        return jsonify({'message': 'Faltan archivos de modelo o imagen.'}), 400

    model_file = request.files['model_file']
    image_file = request.files['image_file']
    
    if model_file.filename == '' or image_file.filename == '':
        return jsonify({'message': 'No se seleccionó ningún archivo.'}), 400

    if model_file and allowed_file(model_file.filename):
        category = request.form.get('category')
        # Crear subdirectorio de categoría si no existe
        category_dir = os.path.join(MODELS_DIR, category)
        os.makedirs(category_dir, exist_ok=True)
        
        model_filename = secrets.token_hex(8) + os.path.splitext(model_file.filename)[1]
        model_path = os.path.join(category_dir, model_filename)
        model_file.save(model_path)

        image_filename = secrets.token_hex(8) + os.path.splitext(image_file.filename)[1]
        image_path = os.path.join(static_dir, 'images', 'shop', image_filename)
        image_file.save(image_path)

        new_item = CosmeticItem(
            name=request.form.get('name'), description=request.form.get('description'),
            price=int(request.form.get('price')), rarity=request.form.get('rarity'),
            category=category, image_path=f'/images/shop/{image_filename}',
            model_path=f'/models/{category}/{model_filename}'
        )
        db.session.add(new_item)
        db.session.commit()
        return jsonify({'message': 'Cosmético creado con éxito.'}), 201

    return jsonify({'message': 'Tipo de archivo de modelo no permitido.'}), 400

# --- API PARA GCHAT ---
@app.route('/api/gchat/history/<int:friend_id>', methods=['GET'])
def get_gchat_history(friend_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header: return jsonify({'error': 'No autenticado'}), 401
    token = auth_header.split(' ')[1]
    try:
        data = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        user_id = data['user_id']

        messages = PrivateMessage.query.filter(
            ((PrivateMessage.sender_id == user_id) & (PrivateMessage.recipient_id == friend_id)) |
            ((PrivateMessage.sender_id == friend_id) & (PrivateMessage.recipient_id == user_id))
        ).order_by(PrivateMessage.timestamp.asc()).all()

        return jsonify([msg.to_dict() for msg in messages])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'error': 'Token inválido'}), 401

@app.route('/api/gchat/send/<int:recipient_id>', methods=['POST'])
def send_private_message(recipient_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header: return jsonify({'error': 'No autenticado'}), 401
    token = auth_header.split(' ')[1]
    try:
        data = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        sender_id = data['user_id']
        content = request.json.get('content')
        message_type = request.json.get('type', 'text')

        if not content: return jsonify({'error': 'El mensaje no puede estar vacío'}), 400

        msg = PrivateMessage(sender_id=sender_id, recipient_id=recipient_id, content=content, message_type=message_type)
        db.session.add(msg)
        db.session.commit()

        # Notificar al destinatario a través de Pusher
        channel_name = f'private-chat-{min(sender_id, recipient_id)}-{max(sender_id, recipient_id)}'
        pusher_client.trigger(channel_name, 'new_message', msg.to_dict())

        return jsonify(msg.to_dict()), 201
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'error': 'Token inválido'}), 401

@app.route('/api/gchat/typing', methods=['POST'])
def gchat_typing_event():
    auth_header = request.headers.get('Authorization')
    if not auth_header: return jsonify({'error': 'No autenticado'}), 401
    token = auth_header.split(' ')[1]
    try:
        data = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        user = User.query.get(data['user_id'])
        if user:
            user.last_typing_time = datetime.utcnow()
            db.session.commit()
            return jsonify({'status': 'ok'}), 200
        return jsonify({'error': 'Usuario no encontrado'}), 404
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'error': 'Token inválido'}), 401

@app.route('/api/gchat/upload_attachment', methods=['POST'])
def upload_gchat_attachment():
    """Sube un archivo adjunto (imagen, video, audio, archivo) para GChat."""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'No autenticado'}), 401
    
    try:
        # Validar el token es una buena práctica aunque no usemos el user_id aquí
        jwt.decode(auth_header.split(' ')[1], app.secret_key, algorithms=['HS256'])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return jsonify({'error': 'Token inválido'}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'No se encontró el archivo.'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Nombre de archivo vacío.'}), 400

    if file:
        filename = secure_filename(secrets.token_hex(8) + os.path.splitext(file.filename)[1])
        upload_dir = os.path.join(frontend_dir, 'uploads', 'chat')
        os.makedirs(upload_dir, exist_ok=True)
        file.save(os.path.join(upload_dir, filename))
        
        # Detectar tipo de archivo
        mime_type, _ = mimetypes.guess_type(filename)
        msg_type = 'file'
        if mime_type:
            if mime_type.startswith('image/'): msg_type = 'image'
            elif mime_type.startswith('video/'): msg_type = 'video'
            elif mime_type.startswith('audio/'): msg_type = 'audio'
            
        return jsonify({'url': f'/uploads/chat/{filename}', 'type': msg_type}), 200

# --- RUTAS Y LÓGICA DEL PANEL DE ADMINISTRADOR ---

def admin_required(f):
    """Decorador para proteger rutas de administrador."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session or not session.get('logged_in'):
            # Para una API, es mejor devolver un error JSON que una redirección.
            return jsonify({'message': 'Se requiere inicio de sesión de administrador'}), 401

        user = User.query.filter_by(username=session.get('username')).first()
        if not user or not user.is_admin:
            return "Acceso denegado. No tienes permisos de administrador.", 403
        
        return f(*args, **kwargs)
    return decorated_function

def public_endpoint(f):
    """Decorador para marcar explícitamente una ruta como pública."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        return f(*args, **kwargs)
    return decorated_function

@app.route('/admin')
@admin_required
def admin_panel():
    # Esta ruta ahora solo serviría el HTML si estuviera en el backend.
    # En una arquitectura SPA, el frontend se encarga de esto.
    # Devolvemos un mensaje para indicar que la ruta existe pero no renderiza.
    return "Acceso al panel de administración. El frontend debe renderizar la interfaz."

@app.route('/register', methods=['POST'])
def register_user():
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
    return jsonify({'success': True, 'message': '¡Registro exitoso! Ahora puedes iniciar sesión.'}), 201

@app.route('/api/admin/update_user', methods=['POST'])
@admin_required
def admin_update_user():
    data = request.get_json()
    user_id = data.get('user_id')
    user_to_update = User.query.get(user_id)
    if not user_to_update:
        return jsonify({'message': 'Usuario no encontrado'}), 404
    
    user_to_update.role = data.get('role', user_to_update.role)
    user_to_update.is_admin = data.get('is_admin', user_to_update.is_admin)
    db.session.commit()
    return jsonify({'message': 'Usuario actualizado correctamente'}), 200

@app.route('/api/admin/users')
@admin_required
def admin_get_users():
    """Devuelve una lista de todos los usuarios para el panel de admin."""
    try:
        users = User.query.order_by(User.id.asc()).all()
        users_data = [{
            'id': user.id,
            'username': user.username,
            'role': user.role,
            'is_admin': user.is_admin,
            'registration_date': user.registration_date.isoformat(),
            'avatar_url': user.avatar_url,
            'is_banned': user.is_banned,
            'banned_until': user.banned_until.isoformat() if user.banned_until else None,
            'ban_reason': user.ban_reason
        } for user in users]
        return jsonify(users_data)
    finally:
        db.session.remove()


@app.route('/api/admin/users/ban', methods=['POST'])
@admin_required
def ban_user():
    data = request.get_json()
    user_id = data.get('user_id')
    duration_hours = data.get('duration_hours')
    reason = data.get('reason')

    user_to_ban = User.query.get(user_id)
    if not user_to_ban:
        return jsonify({'message': 'Usuario no encontrado.'}), 404
    if user_to_ban.is_admin:
        return jsonify({'message': 'No se puede banear a un administrador.'}), 403

    if duration_hours == 0: # Desbanear
        user_to_ban.is_banned = False
        user_to_ban.banned_until = None
        user_to_ban.ban_reason = None
    else:
        user_to_ban.is_banned = True
        user_to_ban.banned_until = datetime.utcnow() + timedelta(hours=duration_hours)
        user_to_ban.ban_reason = reason
    db.session.commit()
    return jsonify({'message': f'Usuario {user_to_ban.username} ha sido actualizado.'}), 200

@app.route('/api/chat_messages')
@public_endpoint
def get_chat_messages():
    """Obtiene los mensajes del chat. Si no hay, devuelve mensajes de prueba."""
    since_timestamp_str = request.args.get('since')
    query = ChatMessage.query

    if since_timestamp_str:
        try:
            since_timestamp = datetime.fromisoformat(since_timestamp_str.replace('Z', '+00:00'))
            query = query.filter(ChatMessage.timestamp > since_timestamp)
            messages = query.order_by(ChatMessage.timestamp.asc()).all()
        except ValueError:
            return jsonify({"error": "Formato de fecha inválido"}), 400
    else:
        # Si no hay 'since', obtiene los últimos 50 mensajes en orden descendente
        messages_desc = query.order_by(ChatMessage.timestamp.desc()).limit(50).all()
        # Luego los invierte para que el orden final sea cronológico
        messages = list(reversed(messages_desc))
    
    if not messages:
        # Si no hay mensajes en la DB, devuelve una lista de mensajes de bot para pruebas.
        now = datetime.utcnow()
        bot_messages = [
            {
                'id': -1, 'username': 'GLauncher-Bot', 'content': '¡Hola! Soy el bot de GLauncher. Este es un chat de prueba para que veas cómo funciona. 🔥', 
                'type': 'text', 'timestamp': (now - timedelta(minutes=5)).isoformat(),
                'role': 'Pico de Netherite', 'username_color': '#ff00ff'
            },
            {
                'id': -2, 'username': 'DJ-TROPIRUMBA', 'content': '¡Saludos a todos los que sintonizan Tropirumba Stereo! 🎶 ¿Listos para la mejor música?', 
                'type': 'text', 'timestamp': (now - timedelta(minutes=3)).isoformat(),
                'role': 'Pico de Diamante', 'username_color': '#00ffff'
            },
            {
                'id': -3, 'username': 'Usuario-Test', 'content': '¡Esto se ve genial! Probando el historial de chat. 🚀', 
                'type': 'text', 'timestamp': (now - timedelta(minutes=1)).isoformat(),
                'role': 'Pico de madera', 'username_color': '#ffffff'
            }
        ]
        return jsonify(bot_messages)
    else:
        return jsonify([msg.to_dict() for msg in messages])

@app.route('/api/chat_messages/create', methods=['POST'])
def create_chat_message():
    data = request.get_json()
    if not data or not data.get('content'):
        return jsonify({'error': 'El contenido no puede estar vacío'}), 400

    user = None
    username = data.get('username', 'Invitado')
    role = 'Invitado'
    username_color = data.get('color')

    # Verificar si hay un token de autenticación para identificar al usuario
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        try:
            # Decodificar el token para obtener el ID del usuario
            token_data = jwt.decode(token, app.secret_key, algorithms=['HS256'])
            user = User.query.filter_by(id=token_data['user_id']).first()
            if user:
                update_user_role(user) # Aseguramos que el rol esté actualizado
                username = user.username
                role = user.role

                # Lógica anti-spam solo para usuarios logueados
                now = datetime.utcnow()
                if user.last_message_time and (now - user.last_message_time).total_seconds() < 3: # Límite de 3 segundos
                    return jsonify({'error': 'Estás enviando mensajes demasiado rápido.'}), 429
                user.last_message_time = now

        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            # Si el token es inválido, simplemente se ignora y el usuario postea como invitado.
            pass

    new_message = ChatMessage(
        user_id=user.id if user else None,
        username=username,
        role=role,
        username_color=username_color,
        content=data.get('content'),
        message_type=data.get('type', 'text')
    )
    db.session.add(new_message)
    db.session.commit()
    
    # LÓGICA DE PUSHER (Notifica a los clientes)
    try:
        pusher_client.trigger('presence-chat_radio', 'new_message', new_message.to_dict())
    except Exception as e:
        print(f"Error al enviar mensaje por Pusher: {e}") 
        
    return jsonify(new_message.to_dict()), 201

@app.route('/api/chat_messages/<int:message_id>', methods=['DELETE'])
@admin_required
def delete_chat_message(message_id):
    """Elimina un único mensaje del chat."""
    try:
        message = ChatMessage.query.get(message_id)
        if not message:
            return jsonify({'message': 'Mensaje no encontrado.'}), 404
        
        db.session.delete(message)
        db.session.commit()
        return jsonify({'message': 'Mensaje eliminado con éxito.'}), 200
    except Exception as e:
        return jsonify({'message': f'Error al eliminar el mensaje: {str(e)}'}), 500

@app.route('/api/chat_messages/all', methods=['DELETE'])
@admin_required
def delete_all_chat_messages():
    """Elimina todos los mensajes del chat."""
    try:
        db.session.query(ChatMessage).delete()
        db.session.commit()
        return jsonify({'message': 'Todos los mensajes han sido eliminados.'}), 200
    except Exception as e:
        return jsonify({'message': f'Error al limpiar el chat: {str(e)}'}), 500

@app.route('/api/gemini-chat', methods=['POST'])
@admin_required
def gemini_chat():
    API_KEY = os.environ.get('GEMINI_API_KEY')
    if not API_KEY:
        return jsonify({'answer': "Error: La clave de API de Gemini no está configurada en el servidor."}), 500
    try:
        genai.configure(api_key=API_KEY)
    except Exception as e:
        return jsonify({'answer': f"Error de configuración de la API: {e}"}), 500

    try:
        # Extraer datos del formulario
        history_str = request.form.get('history', '[]')
        section = request.form.get('section', 'general')
        uploaded_file = request.files.get('file')

        # El historial viene como un string JSON, hay que convertirlo
        chat_history = json.loads(history_str)
        
        # El último mensaje es el prompt actual del usuario
        last_user_prompt = chat_history[-1]['parts'][0]['text']

        # Preparar el contenido para la API
        prompt_parts = [f"Contexto: Estás en la sección '{section}' del panel de administración. Responde a la siguiente pregunta: {last_user_prompt}"]

        if uploaded_file:
            # Si es una imagen, la procesamos
            if uploaded_file.content_type.startswith('image/'):
                img = Image.open(uploaded_file.stream)
                prompt_parts.append(img)
                # Usar el modelo vision
                model = genai.GenerativeModel('gemini-pro-vision')
            else:
                # Si es otro tipo de archivo, leemos su contenido como texto
                file_content = uploaded_file.read().decode('utf-8', errors='ignore')
                prompt_parts.append(f"\n\nContenido del archivo adjunto '{uploaded_file.filename}':\n---\n{file_content}")
                model = genai.GenerativeModel('gemini-pro')
        else:
            model = genai.GenerativeModel('gemini-pro')

        response = model.generate_content(prompt_parts)
        return jsonify({'answer': response.text})

    except Exception as e:
        return jsonify({'answer': f"Ocurrió un error al procesar la solicitud: {e}"}), 500

@app.route('/api/admin/wipe_all_data', methods=['POST'])
@admin_required
def wipe_all_data():
    """
    Elimina todos los usuarios (excepto administradores) y todos los mensajes del chat.
    ¡ACCIÓN MUY DESTRUCTIVA!
    """
    try:
        # Eliminar todos los mensajes del chat
        num_messages_deleted = db.session.query(ChatMessage).delete()
        
        # Eliminar todos los usuarios que NO son administradores
        num_users_deleted = User.query.filter_by(is_admin=False).delete()
        
        db.session.commit()
        
        return jsonify({'message': f'Limpieza completada. Se eliminaron {num_users_deleted} usuarios y {num_messages_deleted} mensajes.'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Error durante la limpieza: {str(e)}'}), 500

@app.route('/api/youtube/search', methods=['GET'])
@admin_required
def youtube_search():
    """Busca videos en YouTube usando la API de YouTube Data v3."""
    query = request.args.get('q')
    api_key = os.environ.get('YOUTUBE_API_KEY')

    if not query:
        return jsonify({'error': 'El parámetro de búsqueda "q" es requerido.'}), 400
    if not api_key:
        return jsonify({'error': 'La clave de API de YouTube no está configurada en el servidor.'}), 500

    try:
        youtube = build('youtube', 'v3', developerKey=api_key)
        search_response = youtube.search().list(
            q=query,
            part='snippet',
            maxResults=10,
            type='video'
        ).execute()

        videos = [{'title': item['snippet']['title'], 'videoId': item['id']['videoId']} for item in search_response.get('items', [])]
        return jsonify(videos)
    except HttpError as e:
        return jsonify({'error': f'Ocurrió un error con la API de YouTube: {e.resp.status} {e.content}'}), 500
    except Exception as e:
        return jsonify({'error': f'Ocurrió un error inesperado: {str(e)}'}), 500

@app.route('/api/admin/status')
@admin_required
def get_system_status():
    """Comprueba y devuelve el estado de los servicios clave."""
    status = {
        'backend': {'status': 'online', 'message': 'API operativa.'},
        'gemini': {'status': 'loading', 'message': 'Comprobando...'},
        'pusher': {'status': 'loading', 'message': 'Comprobando...'},
        'youtube': {'status': 'loading', 'message': 'Comprobando...'}
    }

    # Comprobar Gemini
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        status['gemini'] = {'status': 'offline', 'message': 'Clave API no configurada.'}
    else:
        try:
            genai.configure(api_key=api_key)
            # Hacemos una petición simple para verificar la clave
            model = genai.GenerativeModel('gemini-pro')
            model.generate_content("Test", generation_config=genai.types.GenerationConfig(max_output_tokens=5))
            status['gemini'] = {'status': 'online', 'message': 'Servicio operativo.'}
        except Exception as e:
            status['gemini'] = {'status': 'offline', 'message': 'Clave API inválida o error de servicio.'}

    # Comprobar Pusher
    if all([os.environ.get('PUSHER_APP_ID'), os.environ.get('PUSHER_KEY'), os.environ.get('PUSHER_SECRET')]):
        try:
            pusher_client.trigger('presence-test', 'test_event', {'message': 'ping'})
            status['pusher'] = {'status': 'online', 'message': 'Servicio operativo.'}
        except Exception as e:
            status['pusher'] = {'status': 'offline', 'message': f'Error de conexión: {e}'}
    else:
        status['pusher'] = {'status': 'offline', 'message': 'Claves no configuradas.'}

    # Comprobar YouTube API
    yt_api_key = os.environ.get('YOUTUBE_API_KEY')
    if not yt_api_key:
        status['youtube'] = {'status': 'offline', 'message': 'Clave API no configurada.'}
    else:
        try:
            youtube = build('youtube', 'v3', developerKey=yt_api_key)
            # Hacemos una petición simple para verificar la clave
            youtube.search().list(q='test', part='id', maxResults=1).execute()
            status['youtube'] = {'status': 'online', 'message': 'Servicio operativo.'}
        except HttpError as e:
            status['youtube'] = {'status': 'offline', 'message': f'Clave API inválida o error de servicio.'}
        except Exception as e:
            status['youtube'] = {'status': 'offline', 'message': f'Error de conexión: {str(e)}'}

    return jsonify(status)

@app.route('/api/admin/settings/gemini-key', methods=['POST'])
@admin_required
def set_gemini_api_key():
    # ¡¡¡ADVERTENCIA!!! Esto NO guarda la clave de forma persistente en Vercel.
    # Las variables de entorno en Vercel deben cambiarse en su dashboard.
    # Esta ruta sirve como demostración o para entornos donde se puedan modificar.
    return jsonify({'message': 'Funcionalidad no soportada en este entorno. Cambia la clave en el dashboard de Vercel.'}), 400
# --- Rutas para OAuth (Google y Microsoft) ---
@app.route('/login/google')
def login_google():
    # ¡CORRECCIÓN! Asegurarse de que la URI de redirección sea HTTPS en producción.
    # Forzar el esquema a https es más robusto.
    redirect_uri = url_for('auth_google', _external=True, _scheme='https')
    return oauth.google.authorize_redirect(redirect_uri)

@app.route('/login/google/callback')
def auth_google():
    try:
        token = oauth.google.authorize_access_token()
        user_info = oauth.google.userinfo(token=token)
    except Exception as e:
        # Si falla la autorización (ej. 'invalid_client'), redirige con error.
        error_message = f"Error de autenticación con Google: {e}"
        print(f"OAuth Error: {error_message}")
        return redirect(f"{FRONTEND_LOGIN_URL}?error=auth_failed")

    try:
        social_id = user_info.get('sub')
        if not social_id:
            return redirect(f"{FRONTEND_LOGIN_URL}?error=missing_id")

        avatar_url = user_info.get('picture')
        user = User.query.filter_by(provider='google', social_id=social_id).first()

        if not user:
            username = user_info.get('name', user_info.get('given_name', f"user_{social_id[:8]}"))
            if User.query.filter_by(username=username).first():
                username = f"{username}_{social_id[:4]}"
            
            # 1. Crear el usuario en la base de datos con datos provisionales.
            new_user = User(username=username, provider='google', social_id=social_id, avatar_url=avatar_url, security_code=secrets.token_hex(3))
            db.session.add(new_user)
            db.session.commit()
            user = new_user

            # Crear un token temporal con toda la información necesaria
            # Ahora usamos el ID de usuario real para mayor seguridad.
            temp_token_payload = {'social_id': social_id, 'user_id': user.id, 'username': username, 'avatar_url': avatar_url}
            temp_token = jwt.encode(temp_token_payload, app.secret_key, algorithm='HS256')
            return redirect(f"{FRONTEND_REDIRECT_URL}?temp_token={temp_token}")

        # Generar un token JWT para el usuario
        jwt_token = jwt.encode(
            {'user_id': user.id, 'username': user.username},
           app.secret_key,
            algorithm='HS256'
        )
        return redirect(f"{FRONTEND_REDIRECT_URL}?token={jwt_token}")
    finally:
        db.session.remove()

@app.route('/login/microsoft')
def login_microsoft():
    # Forzar HTTPS para la URI de redirección de Microsoft también.
    redirect_uri = url_for('auth_microsoft', _external=True, _scheme='https')
    return oauth.microsoft.authorize_redirect(redirect_uri)

@app.route('/login/microsoft/callback')
def auth_microsoft():
    try:
        token = oauth.microsoft.authorize_access_token()
        user_info = oauth.microsoft.userinfo(token=token)
    except Exception as e:
        error_message = f"Error de autenticación con Microsoft: {e}"
        print(f"OAuth Error: {error_message}")
        return redirect(f"{FRONTEND_LOGIN_URL}?error=auth_failed")

    try:
        social_id = user_info.get('sub') # 'sub' es el estándar OpenID
        if not social_id:
            return redirect(f"{FRONTEND_LOGIN_URL}?error=missing_id")

        # La lógica para obtener el avatar de Xbox se ha eliminado para resolver un conflicto de dependencias.
        avatar_url = None

        user = User.query.filter_by(provider='microsoft', social_id=social_id).first()
        
        if not user:
            # Flujo para un NUEVO usuario de Microsoft
            username = user_info.get('displayName', f"user_{social_id[:8]}")
            if User.query.filter_by(username=username).first():
                username = f"{username}_{social_id[:4]}"
            
            # 1. Crear el usuario en la base de datos con datos provisionales.
            new_user = User(username=username, provider='microsoft', social_id=social_id, avatar_url=avatar_url, security_code=secrets.token_hex(3))
            db.session.add(new_user)
            db.session.commit()
            user = new_user

            # 2. Crear un token temporal y redirigir a la página para completar el registro.
            temp_token_payload = {'social_id': social_id, 'user_id': user.id, 'username': username, 'avatar_url': avatar_url}
            temp_token = jwt.encode(temp_token_payload, app.secret_key, algorithm='HS256')
            return redirect(f"{FRONTEND_REDIRECT_URL}?temp_token={temp_token}")

        # Flujo para un usuario de Microsoft EXISTENTE: generar token de sesión y redirigir al dashboard.
        jwt_token = jwt.encode(
            {'user_id': user.id, 'username': user.username}, app.secret_key, algorithm='HS256'
        )
        return redirect(f"{FRONTEND_REDIRECT_URL}?token={jwt_token}")
    finally:
        # Asegura que la sesión de la DB se cierre correctamente.
        db.session.remove()

# --- ENDPOINT DE AUTENTICACIÓN PARA PUSHER (PRESENCE CHANNELS) ---
@app.route("/pusher/auth", methods=['POST'])
def pusher_authentication():
    """Autentica a los usuarios para los canales de presencia de Pusher."""
    auth_header = request.headers.get('Authorization')
    user_data = {}

    if not auth_header or not auth_header.startswith('Bearer '):
        # Si no hay token, es un invitado.
        user_data = {'user_id': f"invitado_{secrets.token_hex(4)}"}
    else:
        token = auth_header.split(" ")[1]
        try:
            # Si hay token, lo validamos para obtener los datos del usuario.
            data = jwt.decode(token, app.secret_key, algorithms=['HS256'])
            user = User.query.get(data['user_id'])
            if user:
                user_data = {'user_id': user.id, 'user_info': {'username': user.username, 'role': user.role, 'status': user.status}}
            else: # Token válido pero usuario no encontrado
                user_data = {'user_id': f"invitado_{secrets.token_hex(4)}"}
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            # Si el token es inválido, también es un invitado.
            return "Forbidden: Invalid token", 403

    try:
        auth = pusher_client.authenticate(
            channel=request.form['channel_name'], socket_id=request.form['socket_id'], custom_data=user_data
        )
        return jsonify(auth)
    except pusher.errors.PusherError as e:
        return f"Error de autenticación de Pusher: {e}", 403

# --- API PARA EL MURO DE LA COMUNIDAD ---
@app.route('/api/launch_messages', methods=['GET'])
def get_launch_messages():
    """Obtiene los mensajes del muro de la comunidad con paginación."""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 10, type=int)
    
    pagination = LaunchMessage.query.order_by(LaunchMessage.timestamp.desc()).paginate(page=page, per_page=limit, error_out=False)
    messages = pagination.items
    
    return jsonify({
        'messages': [msg.to_dict() for msg in messages],
        'has_more': pagination.has_next
    })

@app.route('/api/launch_messages/create', methods=['POST'])
def create_launch_message():
    """Crea un nuevo mensaje en el muro de la comunidad."""
    data = request.get_json()
    username = data.get('username')
    content = data.get('content')

    if not username or not content:
        return jsonify({'message': 'El nombre y el contenido no pueden estar vacíos.'}), 400
    if len(username) > 25 or len(content) > 200:
        return jsonify({'message': 'El nombre o el contenido exceden el límite de caracteres.'}), 400

    # Aquí podrías añadir un filtro de profanidad si lo deseas

    new_message = LaunchMessage(username=username, content=content)
    db.session.add(new_message)
    db.session.commit()

    # Notificar a todos los clientes a través de Pusher
    pusher_client.trigger('community_wall', 'new_message', {'message': new_message.to_dict()})

    return jsonify({'message': 'Mensaje publicado con éxito.', 'data': new_message.to_dict()}), 201

# --- FUNCIÓN PARA CREAR TABLAS ---
def create_tables():
    """Crea todas las tablas de la base de datos si no existen."""
    with app.app_context():
        db.create_all()

# Llama a la función para crear las tablas al iniciar la aplicación.
create_tables()

@app.route('/create_first_admin')
def create_first_admin():
    """Ruta temporal para crear el primer usuario administrador. Se debe eliminar después del primer uso."""
    # Comprueba si ya existe un administrador para evitar crear más de uno.
    if User.query.filter_by(is_admin=True).first():
        return "Un administrador ya existe. Esta función está desactivada.", 403

    # Define las credenciales del administrador aquí
    admin_username = "admin"
    admin_password = "password123" # ¡Cambia esto por una contraseña segura!

    hashed_password = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    admin_user = User(username=admin_username, password_hash=hashed_password, is_admin=True, role="Pico de Netherite")
    db.session.add(admin_user)
    db.session.commit()
    return f"¡Usuario administrador '{admin_username}' creado con éxito! Ya puedes borrar esta ruta de app.py."