from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from authlib.integrations.flask_client import OAuth
import bcrypt
from datetime import datetime
import os 
import secrets 
import pusher # Librería para la solución del chat
from functools import wraps
import google.generativeai as genai
import json
from PIL import Image
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

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
# La carpeta raíz del frontend (para los HTML principales) sigue estando un nivel arriba.
root_dir = os.path.join(current_dir, '..')

# URL del frontend para redirecciones seguras
FRONTEND_DASHBOARD_URL = 'https://glauncher.vercel.app/dashboard.html'

# Configuración de la base de datos.
# En producción (Render), usa la variable de entorno DATABASE_URL.
# En local, crea un archivo 'glauncher.db' en la nueva carpeta 'static/data'.
data_dir = os.path.join(static_dir, 'data')
os.makedirs(data_dir, exist_ok=True) # Asegura que la carpeta 'data' exista.
local_db_path = os.path.join(data_dir, 'glauncher.db')
DATABASE_URL = os.environ.get('DATABASE_URL', f'sqlite:///{local_db_path}')

# Inicializamos Flask.
# - `template_folder`: Apunta a la raíz para encontrar los HTML principales (index.html, etc.).
# - `static_folder`: Apunta a la nueva carpeta 'static' para servir los archivos de prueba.
app = Flask(__name__,
            template_folder=root_dir,
            static_folder=static_dir
           )

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

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    content = db.Column(db.String(500), nullable=False)
    message_type = db.Column(db.String(10), nullable=False, default='text') 
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {'id': self.id, 'username': self.username, 'content': self.content, 'type': self.message_type, 'timestamp': self.timestamp.isoformat()}

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
        return {'id': self.id, 'username': self.username, 'content': self.content, 'type': self.message_type, 'timestamp': self.timestamp.isoformat()}

# --- CONFIGURACIÓN DE OAUTH 2.0 (Usando Variables de Entorno) ---
# Se asume que GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MICROSOFT_CLIENT_ID, y MICROSOFT_CLIENT_SECRET 
# están definidos en las variables de entorno de Vercel.
oauth.register(
    name='google',
    client_id=os.environ.get('GOOGLE_CLIENT_ID'),
    client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
    # Usar server_metadata_url es la forma moderna y recomendada.
    # Descubre automáticamente los endpoints de Google.
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

oauth.register(
    name='microsoft',
    client_id=os.environ.get('MICROSOFT_CLIENT_ID'),
    client_secret=os.environ.get('MICROSOFT_CLIENT_SECRET'),
    # Usar server_metadata_url para que authlib descubra los endpoints automáticamente.
    server_metadata_url='https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid profile email User.Read'},
)

# --- RUTAS DE LA APLICACIÓN ---

@app.route('/')
def index():
    # Ahora la ruta raíz del backend sirve la página de pruebas.
    # Los usuarios normales accederán a través de glauncher.vercel.app, no de la URL de la API.
    return send_from_directory(static_dir, 'test_suite.html')


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

@app.route('/privacy-policy')
def privacy_policy():
    return render_template('privacy-policy.html')

@app.route('/terms-and-conditions')
def terms_and_conditions():
    return render_template('terms-and-conditions.html')

@app.route('/shop')
def shop():
    return render_template('shop.html')

@app.route('/dashboard')
def dashboard():
    # Se elimina la comprobación de inicio de sesión para permitir el acceso público al dashboard.
    return render_template('dashboard.html')

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    session.pop('username_for_2fa', None)
    session.pop('username', None)
    return redirect(url_for('index'))

# --- API para Noticias ---
@app.route('/api/news')
def get_news():
    try:
        news_items = News.query.order_by(News.id.desc()).all()
        news_data = [{
            "id": item.id,
            "title": item.title,
            "date": item.date,
            "category": item.category,
            "summary": item.summary,
            "image": item.image,
            "link": item.link,
            "icon": item.icon,
            "buttonText": item.buttonText
        } for item in news_items]
        return jsonify(news_data)
    except Exception as e:
        # Si la tabla no existe, devuelve datos de ejemplo
        # En un entorno de producción, aquí se registraría el error.
        print(f"Error al acceder a la tabla News: {e}. Devolviendo datos de ejemplo.")
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
    if 'logged_in' in session and session.get('logged_in'):
        try:
            user = User.query.filter_by(username=session.get('username')).first()
            if user:
                # Actualiza el rol del usuario antes de enviar la información
                update_user_role(user)
                return jsonify({
                    'username': user.username,
                    'is_admin': user.is_admin,
                    'avatar_url': user.avatar_url,
                    'role': user.role,  # Devuelve el rol actualizado
                    'gcoins': user.gcoins # Devuelve el saldo de GCoins
                })
        finally:
            # Asegura que la sesión se cierre
            db.session.remove()
    return jsonify({'error': 'No autenticado'}), 401

# --- RUTAS Y LÓGICA DEL PANEL DE ADMINISTRADOR ---

def admin_required(f):
    """Decorador para proteger rutas de administrador."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session or not session.get('logged_in'):
            return redirect(url_for('login'))
        
        user = User.query.filter_by(username=session.get('username')).first()
        if not user or not user.is_admin:
            return "Acceso denegado. No tienes permisos de administrador.", 403
        
        return f(*args, **kwargs)
    return decorated_function

@app.route('/admin')
@admin_required
def admin_panel():
    all_users = User.query.order_by(User.id.asc()).all()
    return render_template('admin.html', users=all_users)

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
            'avatar_url': user.avatar_url
        } for user in users]
        return jsonify(users_data)
    finally:
        db.session.remove()


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
        # Si no hay 'since', obtiene los últimos 50 mensajes en orden descendente
        messages_desc = query.order_by(ChatMessage.timestamp.desc()).limit(50).all()
        # Luego los invierte para que el orden final sea ascendente (el más antiguo primero)
        messages = list(reversed(messages_desc))
    
    return jsonify([msg.to_dict() for msg in messages])

@app.route('/api/chat_messages/create', methods=['POST'])
@admin_required # Protegido para que solo el admin pueda enviar mensajes de sistema
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
    # Render y otros proveedores usan un proxy inverso, por lo que _external=True puede no ser suficiente.
    # Forzar el esquema a https es más robusto.
    redirect_uri = url_for('auth_google', _external=True, _scheme='https')
    return oauth.google.authorize_redirect(redirect_uri)

@app.route('/login/google/callback')
def auth_google():
    redirect_uri = url_for('auth_google', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

@app.route('/login/google/callback')
def auth_google():
    token = oauth.google.authorize_access_token()
    # ¡CORRECCIÓN CRÍTICA! Pasar el token explícitamente a userinfo()
    # para asegurar la robustez en entornos de producción como Render.
    user_info = oauth.google.userinfo(token=token)
    social_id = user_info.get('sub')
    avatar_url = user_info.get('picture')

    if not social_id:
        return 'Error: No se pudo obtener el ID de usuario de Google.', 400

    try:
        user = User.query.filter_by(provider='google', social_id=social_id).first()
        if not user:
            username = user_info.get('name', user_info.get('given_name', f"user_{social_id[:8]}"))
            if User.query.filter_by(username=username).first():
                username = f"{username}_{social_id[:4]}"
            new_user = User(username=username, provider='google', social_id=social_id, avatar_url=avatar_url)
            db.session.add(new_user)
            db.session.commit()
            user = new_user

        session['logged_in'] = True
        session['username'] = user.username
        return redirect(FRONTEND_DASHBOARD_URL)
    finally:
        # Asegura que la sesión de la DB se cierre correctamente para evitar errores 500.
        db.session.remove()

@app.route('/login/microsoft')
def login_microsoft():
    # Forzar HTTPS para la URI de redirección de Microsoft también.
    redirect_uri = url_for('auth_microsoft', _external=True, _scheme='https')
    return oauth.microsoft.authorize_redirect(redirect_uri)

@app.route('/login/microsoft/callback')
def auth_microsoft():
    # ¡CORREGIDO! Usar oauth.microsoft en lugar de oauth.google
    token = oauth.microsoft.authorize_access_token()
    # ¡CORRECCIÓN CRÍTICA! Pasar el token explícitamente a userinfo()
    # para asegurar la robustez en entornos de producción.
    user_info = oauth.microsoft.userinfo(token=token)
    social_id = user_info.get('id')
    avatar_url = None

    # Intenta obtener la foto de perfil de Microsoft Graph API
    try:
        photo_response = oauth.microsoft.get('https://graph.microsoft.com/v1.0/me/photo/$value', stream=True)
        if photo_response.status_code == 200:
            # En un futuro, aquí se podría procesar y guardar la imagen.
            # Por ahora, la funcionalidad para obtener la URL directa es compleja, se omite.
            pass
    except Exception:
        pass # Si no hay foto o hay un error, no hacemos nada.

    if not social_id:
        return 'Error: No se pudo obtener el ID de usuario de Microsoft.', 400

    try:
        user = User.query.filter_by(provider='microsoft', social_id=social_id).first()
        if not user:
            username = user_info.get('displayName', f"user_{social_id[:8]}")
            if User.query.filter_by(username=username).first():
                username = f"{username}_{social_id[:4]}"
            new_user = User(username=username, provider='microsoft', social_id=social_id, avatar_url=avatar_url)
            db.session.add(new_user)
            db.session.commit()
            user = new_user

        session['logged_in'] = True
        session['username'] = user.username
        return redirect(FRONTEND_DASHBOARD_URL)
    finally:
        # Asegura que la sesión de la DB se cierre correctamente.
        db.session.remove()

# --- FUNCIÓN PARA CREAR TABLAS ---
def create_tables():
    """Crea todas las tablas de la base de datos si no existen."""
    with app.app_context():
        db.create_all()

# Llama a la función para crear las tablas al iniciar la aplicación.
create_tables()

# -------------------------------------------------------------
# *** NOTA: El bloque de ejecución local ha sido ELIMINADO para compatibilidad con Vercel. ***
# -------------------------------------------------------------